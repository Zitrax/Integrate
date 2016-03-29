timer_id = null;

$( document ).ready(function() {
    // Not optimal - there could be another extension starting with the same name
    // We should really get the base from the API somehow and drop this whole pref code
    // ------------------
    var td = $('span.name').filter(function() { return $(this).text().indexOf("Integrate") == 0; }).parent();
    td.find('tr:last').after('<tr><th colspan="2">Preferences</th></tr>');
    td.find('tr:last').after('<tr><td class="pattern">Remote base:</td>' +
			     '<td class="description"><input id="remote_base" type="text"></input></td></tr>');

    $('input#remote_base').bind('change input', schedule_set_prefs);
    
    var operation = new critic.Operation({
      action: "Show extension prefs",
      url: "Integrate/get_prefs",
      callback: show_prefs
    });
    operation.execute();    
});

function show_prefs(result) {
    $('input#remote_base').val(result.remote_base);
}

function schedule_set_prefs() {
    if( timer_id != null )
	clearTimeout(timer_id);
    timer_id = setTimeout(set_prefs, 500);
}

function set_prefs() {
    var operation = new critic.Operation({
	action: "Set extension prefs",
	url: "Integrate/set_prefs",
	data: { remote_base: $('input#remote_base').val() },
	callback: set_prefs_done
    });
    operation.execute();    

}

function set_prefs_done() {
}
