function submitLogin() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'user': $('input[name=user]').val(),
		'pass': $('input[name=pass]').val()
	};
	
    $.ajax({
		url: "/ajax/login",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				window.location.href = "/servers";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

$(function() {
	$("#loginForm").find('input').keypress(function(e) {
		if(e.which == 10 || e.which == 13) {
			submitLogin();
		}
	});
});