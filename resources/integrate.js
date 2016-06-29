$( document ).ready(function() {
    var operation = new critic.Operation({
      action: "Check if review is ready",
      url: "Integrate/ready",
      data: { review_id: critic.review.id },
      callback: add_button
    });
    operation.execute();
});

function add_button(result) {
    if( result.accepted ) {
	critic.buttons.add({title: "Integrate",
			    onclick: candidates,
			    scope: "global"})
    }
}

function candidates() {

    operation = new critic.Operation({
	action: "Find branch candidates",
	url: "Integrate/candidates",
	data: { review_id: critic.review.id, rebase: null },
	wait: "Finding branch candidates...",
	callback: select_branch
    });

    // Seems like we can't reliably find the most recent rebase in the extension api
    // so use the json api to find it and pass along.
    $.getJSON("/api/v1/reviews/" + critic.review.id + "/rebases")
	.done(function(data) {
	    var rebased = false;
	    $.each( data.rebases, function(key, val) {
		if(val.type == "move" || val.type == "history-rewrite") {
		    $.getJSON("/api/v1/reviews/" + critic.review.id).done(function(data) {
			var new_commit = val.type == "move" ? val.new_upstream : val.new_head;
			$.getJSON("/api/v1/commits/" + new_commit + "?repository=" + data.repository)
			    .done(function(data) {
				operation.data.rebase = data.sha1;
				operation.execute();
			    });
		    });
		    rebased = true;
		    return false; // breaks loop
		}
	    });
	    if( !rebased )
		operation.execute();
	});
}

function select_branch(result) {
    var select = $('<select>');
    if( result == null ) {
	return;
    }
    $.each(result.branches, function(id, val) {
	select.append($('<option>').attr('value', val).text(val));
    });
    var dialog = $('<div title="Chose target branch">' +
		   '<p>Select a branch on which you want the changes integrated:</p>' +
		   '</div>');
    dialog.append(select);
    dialog.dialog({
	width: 500,
	buttons: {
	    "Ok": function() { $(this).dialog("close");
			       can_push(select.val()); },
	    "Cancel": function() { $(this).dialog("close"); }
	}
    });
}

function can_push(branch) {
    var operation = new critic.Operation({
	action: "Check if integration is possible",
	url: "Integrate/can_push",
	data: { review_id: critic.review.id,
		branch: branch },
	wait: "Checking...",
	callback: do_push_dialog
    });
    operation.execute();
}

function do_push_dialog(res) {
    if(res == null) {
	return;
    }
    if(!res.integratable) {
	var dialog = $('<div title="Needs rebase">' +
		       '<p>The current review branch is not based on the current ' + res.branch +
		       '. Please rebase it before trying to integrate.</p></div>');
	dialog.dialog({
	    width: 500,
	    buttons: { ok: function() { $(this).dialog("close"); }}
	});
	return;
    }

    var dialog = $('<div title="Push changes to ' + res.branch +'">' +
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
	    action: "Push to " + res.branch,
	    url: "Integrate/push",
	    data: { review_id: critic.review.id, branch: res.branch },
	    wait: "Pushing...",
	    callback: done
	});
	operation.execute();
    }
}

function done(res) {
    console.log(res);
    if( res != null )
	location.reload();
}
