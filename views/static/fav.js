$(document).ready(function() {
	$('tbody > tr').on('click', function() {
		$('#blackout').show()
		let link = $(this)
			.children('td')
			.children('a')
			.attr('href')
		window.location.href = link
	})
	$('#fav').toggleClass('active')
	$('table.table').css('display', 'table')
	$('table.table').DataTable({
		paging: false,
		searching: false,
		info: false,
		pageLength: 999,
		order: [[4, 'desc']],
		columns: [
			{ width: '17%', orderable: false },
			{ width: '80%', orderable: true },
			{ width: '1%', orderable: true },
			{ width: '1%', orderable: true },
			{ width: '1%', orderable: true },
		],
	})
})
