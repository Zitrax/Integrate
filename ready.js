function is_ready() {
    var data = JSON.parse(read());
    
    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");

    var review = new critic.Review(data.review_id);

    writeln(JSON.stringify({ status: "ok", accepted: review.progress.accepted,
			     commits: review.commits.tails}))
}
