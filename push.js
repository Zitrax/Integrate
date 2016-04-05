"use strict"

// Finds all users that have actually
// marked something as reviewed in the changed files.
function reviewers(review) {
    var reviewers = {};
    review.branch.commits.forEach(function(commit) {
	review.getChangeset(commit).files.forEach(function(file) {
	    reviewers[file.reviewedBy.name] = true;
	});
    });
    return Object.keys(reviewers).join(", ");
}

function push() {
    var data = JSON.parse(read());

    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");

    try {
	var review = new critic.Review(data.review_id);
	var branch = data.branch;

	// Should already have been checked - but verify
	if( ! review.progress.accepted ) {
	    throw "Review is not accepted";
	}

	// Ready to try to push
	// Assume remote is already setup in can_push()
	var wc = review.branch.getWorkCopy();

	var rnote = "Review-info: Reviewed in r/" + review.id + " by " + reviewers(review);
	// Could have checked for existing notes here, but it seem that pushing notes
	// to critic are rejected anyway.
	wc.run("config", "user.email", critic.User.current.email);
	wc.run("config", "user.name", critic.User.current.fullname);

	// Add the note to each commit in the branch
	review.branch.commits.forEach(function(commit) {
	    try {
		wc.run("notes", "add", "-m", rnote, commit.sha1);
	    } catch (error) {
		// This is fine - a note was already added / assumed by us
	    }
	});

	wc.run("push", "target", "refs/notes/*");

	var out = wc.run("push", "target", "--porcelain", "HEAD:refs/heads/" + branch);
	if( out.split('\n')[1][0] == '=' ) {
	    throw "Already integrated!";
	}

	var new_batch = review.startBatch();
	new_batch.writeNote("[Integrate] Changes merged to " + branch);
	new_batch.finish();

	review.close();

	writeln(JSON.stringify({ status: "ok" }));
    } catch (error) {
	if( error instanceof critic.CriticError ) {
	    throw error;
	}

	writeln(JSON.stringify({ status: "failure",
				 code: "willnotpush",
				 title: "Will not push to " + branch,
				 message: String(error) }));
    }
}

function add_remote(review) {
    var wc = review.branch.getWorkCopy();
    var remotes = wc.run("remote");
    if( remotes.split("\n").indexOf("target") != -1 ) {
	wc.run("remote", "remove", "target");
    }
    var remote_base = critic.storage.get('remote_base');
    // FIXME: Not a guarantee that the repo name is also used at base
    wc.run("remote", "add", "target", remote_base + "/" + review.repository.name);
    wc.run("fetch", "target");
    wc.run("fetch", "target", "refs/notes/*:refs/notes/*");
    return wc
}

function can_push() {
    var data = JSON.parse(read());

    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");

    try {
	var review = new critic.Review(data.review_id);
	var branch = data.branch;

	// Should already have been checked - but verify
	if( ! review.progress.accepted ) {
	    throw "Review is not accepted";
	}

	// Add target and check if the review branch is based on it
	var wc = review.branch.getWorkCopy();
	var remote_base = critic.storage.get('remote_base');
	// wc.run("fetch", "target", branch);
	var merge_base = wc.run("merge-base", "HEAD", "target/" + branch);
	var target_branch = wc.run("rev-parse", "target/" + branch);
	writeln(JSON.stringify({ status: "ok",
				 integratable: merge_base == target_branch,
				 branch: branch }));
    } catch (error) {
	if( error instanceof critic.CriticError ) {
	    throw error;
	}

	writeln(JSON.stringify({ status: "failure",
				 code: "willnotpush",
				 title: "Will not push to " + branch,
				 message: String(error) }));
    }
}

// Try to guess what target branches might be possible
function candidates() {
    var data = JSON.parse(read());

    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");


    try {
	var review = new critic.Review(data.review_id);
	var commits = review.commits;
	// First assume that we have a single tail
	if( commits.tails.length != 1 ) {
	    writeln(JSON.stringify({ status: "ok", branches: ["master"], info: commit.tails.length + " tails" }));
	    return;
	}

	// Add the target remote and fetch
	var wc = add_remote(review);

	// List all branch names at target that contain the tail of the review
	// This indicates that the review might have branched off from there
	// and that it then is a likely candidate for integrating back to.
	// Note: --contains is only supported in git >= 2.7
	var branches = wc.run("for-each-ref", "--format=%(refname:strip=3)",
			      "--contains", commits.tails[0].sha1, "refs/remotes/target").trim();
	branches = branches.split('\n');
	// If master is in the list - we assume the most likely candidate is master
	// At the master level there can be a huge number of irrelevant branches
	if( branches.indexOf('master') != -1) {
	    branches = ['master'];
	}

	if( branches.length == 0 ) {
	    throw "Could not find a candidate branch - not even master!";
	}

	writeln(JSON.stringify({ status: "ok", branches: branches }));

    } catch (error) {
	if( error instanceof critic.CriticError ) {
	    throw error;
	}

	writeln(JSON.stringify({ status: "failure",
				 code: "willnotpush",
				 title: "Will not integrate",
				 message: String(error) }));
    }

}
