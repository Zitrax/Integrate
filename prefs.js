function get_prefs() {
    var remote_base = critic.storage.get('remote_base')

    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");
    writeln(JSON.stringify({ status: "ok", remote_base: remote_base }))
}

function set_prefs() {
    var data = JSON.parse(read());

    critic.storage.set('remote_base', data.remote_base);
    
    writeln("200");
    writeln("Content-Type: text/json");
    writeln("");
    writeln(JSON.stringify({ status: "ok" }))    
}
