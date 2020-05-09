$(document).ready(function() {
	ipc.on('deleted-file', function(_ev, file) {
		$(`tr[data-filename="${file}"]`).remove()
		$('#blackout').hide()
	})
	$('#delete').on('click', function() {
		$('#blackout').show()
		let emit = []
		$('tbody > tr.selected').each(function(i, el) {
			emit.push(
				$(el)
					.children('td')
					.first()
					.text()
			)
		})
		if (emit.length > 0) {
			remote.dialog.showMessageBox({
				type: 'warning',
				title: 'Confirmation',
				buttons: ['No', 'Yes'],
				message: `Are you sure you want to delete these files ?\n\n- ${emit.join('\n- ')}`
			}).then((ok) => {
				if(ok.response) {
					ipc.send('delete-files', emit)
				} else {
					$('#blackout').hide()
				}
			})
		} else {
			$('#blackout').hide()
		}
	})
	$('tbody').on('click', 'tr[data-filename]', function() {
		console.log('clickoty')
		$(this).toggleClass('selected')
	})
	$('#hardrive').toggleClass('active')
	$('table.table').css('display', 'table')
	$('table.table').DataTable({
		paging: false,
		searching: false,
		info: false,
		lengthMenu: [
			[10, 25, 50, -1],
			[10, 25, 50, 'All'],
		],
		order: [[1, 'desc']],
	})
	$('#selectall').on('click', function() {
		$('tbody > tr[data-filename]').toggleClass('selected')
	})
})
