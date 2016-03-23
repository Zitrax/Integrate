$( document ).ready(function() {
    var operation = new critic.Operation({
      action: "Is review ready",
      url: "Integrate/ready",
      data: { review_id: critic.review.id },
      callback: add_button
    });
    operation.execute();    
});

function add_button(result) {
    if( result.accepted ) {
	critic.buttons.add({title: "Integrate",
			    onclick: can_push,
			    scope: "global"})
    }
}

function can_push() {
    var operation = new critic.Operation({
	action: "Check if integration is possible",
	url: "Integrate/can_push",
	data: { review_id: critic.review.id },
	wait: "Checking...",
	callback: do_push_dialog
    });
    operation.execute();
}

function do_push_dialog(res) {
    console.log(res);
    if(res == null) {
	return;
    }
    if(!res.integratable) {
	var dialog = $('<div title="Needs rebase">' +
		       '<p>The current review branch is not based on the current master. Please rebase it before trying to integrate.</p></div>');
	dialog.dialog({
	    width: 500,
	    buttons: { ok: function() { $(this).dialog("close"); }}
	});
	return;
    }
   
    var dialog = $('<div title="Push changes to master">' +
		   '<p>Review branch checked and seem to be OK. Ready to push?</p></div>');
    dialog.dialog({
	width: 500,
	buttons: {
	    "Push": integrate,
	    "Abort": function() { dialog.dialog("close"); }
	}});

    function integrate() {
	dialog.dialog("close");
	var operation = new critic.Operation({
	    action: "Push to master",
	    url: "Integrate/push",
	    data: { review_id: critic.review.id },
	    wait: "Pushing...",
	    callback: done
	});
	operation.execute();
    }
}

function done(res) {
    if( res != null )
	location.reload();
}
