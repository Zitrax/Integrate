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
			    onclick: integrate,
			    scope: "global"})
    }
}

function integrate() {
    var operation = new critic.Operation({
      action: "Push to master",
      url: "Integrate/push",
      data: { review_id: critic.review.id },
      wait: "Pushing...",
      callback: done
    });
    operation.execute();
}

function done(res) {
    location.reload();
}
