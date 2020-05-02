$(document).ready(function() {
	$('.goto').bind('click', function(e) {
		$('#blackout').show()

		window.location.href = $(this).attr('href')
	})
	$('#allshows').toggleClass('active')

	$('table.table').DataTable({
		paging: true,
		searching: true,
		info: true,
		pageLength: 10,
		lengthMenu: [
			[10, 25, 50, -1],
			[10, 25, 50, 'All'],
		],
		order: [[1, 'asc']],
		columns: [
			{ width: '1%', orderable: false },
			{ width: '98%' },
			{ width: '1%', orderable: false },
		],
	})
	$('table.table').toggleClass('d-none')
	$('table').on('click', 'td.MAL', function() {
		ipc.send('data-search', {
			name: $(this).attr('data-name'),
			keyword: $(this).attr('data-search'),
		})
	})
})
