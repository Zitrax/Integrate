function is_ready() {
    var data = JSON.parse(read());
    
    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");

    var review = new critic.Review(data.review_id);

    // Just verify that we can read the ini file
    if( !IO.File.isRegularFile("integrate.ini") ) {
	throw new critic.CriticError("Missing ini file. You need to configure a integrate.ini file in the Integrate extension.");
    }

    writeln(JSON.stringify({ status: "ok", accepted: review.progress.accepted }))
}
