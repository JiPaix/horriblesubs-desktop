$(document).ready(function() {
	ipc.on('fav-update', function(_ev, arg) {
		if(arg) {
			$('sup.badge').text(arg.length)
			$('sup.badge').removeClass('badge-light badge-danger')
			$('sup.badge').addClass('badge-danger')
			let audio = new Audio('static://audio/notif.wav')
			audio.play();
		}
	})
	$('#dlperc').hide()
	$('#exit').on('click', function() {
		ipc.send('quit')
	})
	$('#hide, .hide').on('click', function() {
		remote.BrowserWindow.getFocusedWindow().hide()
	})
	$('#minimize').on('click', function() {
		remote.BrowserWindow.getFocusedWindow().minimize()
	})
	$('#settings').on('click', function() {
		ipc.send('settings-show')
	})
	$('#resize').on('click', function() {
		if ($(this).hasClass('max')) {
			remote.BrowserWindow.getFocusedWindow().unmaximize()
		} else {
			remote.BrowserWindow.getFocusedWindow().maximize()
		}
		$(this).toggleClass('max')
	})
})
