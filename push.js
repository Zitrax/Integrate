"use strict"

function push() {
    var data = JSON.parse(read());
    
    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");

    try {
	var review = new critic.Review(data.review_id);

	// Should already have been checked - but verify
	if( ! review.progress.accepted ) {
	    throw "Review is not accepted";
	}

	// Ready to try to push
	
	var wc = review.branch.getWorkCopy();
	var remotes = wc.run("remote");
	if( remotes.split("\n").indexOf("target") == -1 ) {
	    // FIXME: The remote should not be hardcoded
	    wc.run("remote", "add", "target", "/home/danielb/git_critic_origin/test");
	}

	var out = wc.run("push", "target", "HEAD:refs/heads/master");
	if( out == "" ) {
	    throw "Already integrated!";
	}
	review.close();
    
	writeln(JSON.stringify({ status: "ok" }));
    } catch (error) {
	if( error instanceof critic.CriticError ) {
	    throw error;
	}
	    
	writeln(JSON.stringify({ status: "failure",
				 code: "willnotpush",
				 title: "Will not push to master",
				 message: String(error) }));
    }
}
