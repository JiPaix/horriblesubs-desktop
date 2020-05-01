$(document).ready(function () {

    socket.on('deleted-file', function (file) {
        $(`tr[data-filename="${file}"]`).remove()
        $('#blackout').hide()
    })
    $('#delete').on('click', function () {
        $('#blackout').show()
        let emit = []
        $('tbody > tr.selected').each(function (i, el) {
            emit.push($(el).children('td').first().text())
        })
        if (emit.length > 0) {
            socket.emit('delete-files', emit)
        } else {
            $('#blackout').hide()
        }
    })
    $('tbody').on('click', 'tr[data-filename]', function () {
        $(this).toggleClass('selected');
    });
    $('#hardrive').toggleClass('active')
    $('table.table').css('display', 'table')
    $('table.table').DataTable({
        "paging": false,
        "searching": false,
        "info": false,
        "lengthMenu": [
            [10, 25, 50, -1],
            [10, 25, 50, "All"]
        ],
        "order": [
            [1, "desc"]
        ],
    });
    $('#selectall').on('click', function () {
        $('tbody > tr[data-filename]').toggleClass('selected')
    })
})