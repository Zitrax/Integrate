"use strict"

// Finds all users that have actually
// marked something as reviewed in the changed files.
function reviewers(review) {
    var reviewers = {};

    function collect_reviewers(commit) {
        try {
            review.getChangeset(commit).files.forEach(function(file) {
                reviewers[file.reviewedBy.name] = true;
            });
        } catch(error) {
            // Getting various exceptions when the changesets can't be found. So ignore...
        }
    };

    review.branch.commits.forEach(collect_reviewers);
    review.commits.forEach(collect_reviewers);

    return Object.keys(reviewers).join(", ");
}

function cgit_range(repo, branch, sha1_update) {
    if(!sha1_update) {
        return null;
    }
    var ini = IO.File.read("integrate.ini");
    var cgit_url = ini.decode().match(/cgit_url\s*=\s*(\S*)/);
    if( !cgit_url ) {
        return null;
    }

    var from = sha1_update[1];
    var to = sha1_update[2];

    return "[" + from + ".." + to + "|" + cgit_url[1] + repo +
        "/log/?h=" + branch + "&qt=range&q=" + from + ".." + to + "]";
}

function review_link(id) {
    var ini = IO.File.read("integrate.ini");
    var critic_url = ini.decode().match(/critic_url\s*=\s*(\S*)/);
    return "[r/" + id + "|" + critic_url[1] + "r/" + id + "]";
}

function add_jira_comment(review, branch, sha1_update) {
    try {
        if(!critic.bts) {
            return "no bts";
        }

	review.branch.commits.forEach(function(commit) {
            var issue = null;
            var match = commit.summary.match(/^([A-Z]{2,7}-\d+):.*/);
            if( match ) {
		var rlink = review_link(review.id);
		var repo = review.repository.name;
		var cgit = cgit_range(repo, branch, sha1_update);
		issue = new critic.bts.Issue(match[1]);
		if( cgit ) {
                    issue.addComment("Review " + rlink + " merged to " + branch + " in " + cgit + " in repository " + repo + ".");
		} else {
                    issue.addComment("Review " + rlink + " merged to " + branch + " in repository " + repo + ".");
		}
	    }
        });

	return "jira updated";

    } catch(error) {
        return error;
    }
    return "no issue";

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
        // Assume remote is already setup in candidates()
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
        var sha1_update = null;
        if( out.split('\n')[1][0] == '=' ) {
            throw "Already integrated!";
        } else {
            sha1_update = out.match(/([a-f,0-9]{7,})\.\.([a-f,0-9]{7,})/);
        }

        var jira_info = add_jira_comment(review, branch, sha1_update);

        var new_batch = review.startBatch();
        new_batch.writeNote("[Integrate] Changes merged to " + branch);
        new_batch.finish();

        review.close();

        writeln(JSON.stringify({ status: "ok", jira: String(jira_info) }));
    } catch (error) {
        if( error instanceof critic.CriticError ) {
            throw error;
        }

        writeln(JSON.stringify({ status: "failure",
                                 code: "willnotpush",
                                 title: "Will not push to " + branch,
                                 message: String(error) + "<br><br>" + error.stack}));
    }
}

function rstore() {
    // The values are not per user - but the api require a user
    // so always store the data for user 1.
    return new critic.Storage(new critic.User(1));
}

function get_target_remote(review) {
    var refname = rstore().get('refbranch:' + review.repository.name);
    if(refname == undefined) {
        refname = "master";
    }

    var data = { branch: review.repository.getBranch(refname) };
    return critic.TrackedBranch.find(data).remote;
}

function add_remote(review) {
    var wc = review.branch.getWorkCopy();
    var remotes = wc.run("remote");
    if( remotes.split("\n").indexOf("target") != -1 ) {
        wc.run("remote", "remove", "target");
    }
    var remote_base = get_target_remote(review);
    wc.run("remote", "add", "target", remote_base);
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

        // Add the target remote and fetch
        var wc = add_remote(review);

        // There can be more tails if we have rebased. I did not find a way to
        // reliably know what is the latest one - but we can find it with the
        // json api and is passed here as data.rebase.
        // We also try each tail to find all possibly candidates.
        var sha1s = [];
        if(data.rebase) {
            sha1s.push(data.rebase);
        }
        commits.tails.forEach(function(tail) { sha1s.push(tail.sha1); });

        var all_branches = {};

        sha1s.forEach(function(sha1) {

            // List all branch names at target that contain the tail of the review
            // This indicates that the review might have branched off from there
            // and that it then is a likely candidate for integrating back to.
            // Note: --contains is only supported in git >= 2.7
            var branches = "";
            try {
                var branches = wc.run("for-each-ref", "--format=%(refname:strip=3)",
                                      "--contains", sha1, "refs/remotes/target").trim();
            } catch (error) {
                // FIXME: The above sometimes fails due to missing sha1. Unsure why.
                //        Until this is debugged or turns out to be a real issue just ignore it.
            }
            branches = branches.split('\n');
            branches.forEach(function(b) {
                if(b.length) {
                    all_branches[b] = true;
                }
            });
        });

        all_branches = Object.keys(all_branches);

        // If master is in the list - we assume the most likely candidate is master
        // At the master level there can be a huge number of irrelevant branches
        // 5 is a arbitrarily chosen cut-off to limit the case with irrelevant branches.
        if( all_branches.indexOf('master') != -1 && all_branches.length > 10) {
            all_branches = ['master'];
        }

        if( all_branches.length == 0 || all_branches[0].length == 0) {
            throw "Could not find a candidate branch - not even master!";
        }

        writeln(JSON.stringify({ status: "ok", branches: all_branches }));

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
