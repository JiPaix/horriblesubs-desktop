const socket = io()
$(document).ready(function() {
    socket.on('fav-update', function() {
        $('sup.badge').text(parseInt($('sup.badge').text()) + 1)
    })
    $('#dlperc').hide()
    $('#exit').on('click', function() {
        ipc.send('quit')
    })
    $('#hide, .hide').on('click', function() {
        remote.BrowserWindow.getFocusedWindow().hide()
    })
    $('#minimize').on('click', function() {
        remote.BrowserWindow.getFocusedWindow().minimize();
    })
    $('#settings').on('click', function() {
        ipc.send('settings-show')
    })
    $('#resize').on('click', function () {
        if($(this).hasClass('max')){
            remote.BrowserWindow.getFocusedWindow().unmaximize()
        } else {
            remote.BrowserWindow.getFocusedWindow().maximize()
        }
        $(this).toggleClass('max')
    })
})