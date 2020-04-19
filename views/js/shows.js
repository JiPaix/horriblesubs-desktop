$('document').ready(() => {
    toastr.options.positionClass = "toast-bottom-center"
    toastr.options.preventDuplicates = true
    toastr.options.newestOnTop = true
    let batch = false
    let batchDone = 1
    let showLength = JSON.parse($('#dlall').attr('data')).links.length
    $('#dlall').click(function (e) {
        batch = true
        $('#dlall').fadeOut(1000)
        $('#dlperc').show()
        socket.emit('download all', JSON.parse($(this).attr('data')))
    })
    $('#followthis').click(function (e) {
        if ($(this).hasClass('follow')) {
            socket.emit('follow', myshow.id)
            $(this).html('UNFOLLOW')
        } else {
            socket.emit('unfollow', myshow.id)
            $(this).html('FOLLOW')
        }
        $(this).toggleClass('follow unfollow')
        $(this).toggleClass('btn-warning btn-danger')
    })
    $('button.ep').click(function (e) {
        if (batch === true) {
            toastr.warning('Episodes are still downloading, wait untill the end')
        } else {
            $('#dlperc > .progress-bar').addClass('bg-warning')
            $('#dlperc > .progress-bar').removeClass('bg-danger')
            $('#perblue').animate({
                width: "100%"
            }, 1000);
            myshow.ep = $(this).attr('data-ep')
            socket.emit('watch', {
                ep: myshow.ep,
                name: myshow.name,
                bot: $(this).attr('data-bot'),
                pack: $(this).attr('data-pack')
            })

        }
    })

    socket.on('nobatch', () => {
        $('#dlperc > .progress-bar').removeClass('bg-warning')
        $('#dlperc > .progress-bar').removeClass('bg-info')
        $('#dlperc > .progress-bar').removeClass('bg-success')
        $('#dlperc > .progress-bar').addClass('bg-danger')
        $('#perblue').animate({
            width: "100%"
        }, 1000);
        $('#dlperc').show()
        batch = false
    })

    $('button.file').click(function (e) {
        myshow.ep = $(this).attr('data-ep')
        let src = '/files/' + $(this).attr('data-file')
        $('#player').attr('src', src)
        $('#track').attr('src', src + '.vtt')
        $('video')[0].load()
        let video = document.querySelector('.embed-responsive-16by9')
        video.textTracks[0].mode = 'showing'
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        $('video')[0].play()
        socket.emit('watched', myshow)
    })

    socket.on('watch', fileInfo => {
        console.log(batchDone)
        if (!batch) {
            $('#player').attr('src', '/files/' + fileInfo.file)
            $('video')[0].load()
            $('#track').attr('src', '/files/' + fileInfo.file + '.vtt')
            let video = document.querySelector('.embed-responsive-16by9')
            video.textTracks[0].mode = 'showing'
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            $('video')[0].play()
            $('#dlperc').hide()
            $('#perblue').width('0%')
            socket.emit('watched', myshow)
        } else {
            if (batchDone === 1) {
                $('#player').attr('src', '/files/' + fileInfo.file)
                $('video')[0].load()
                $('#track').attr('src', '/files/' + fileInfo.file + '.vtt')
                let video = document.querySelector('.embed-responsive-16by9')
                video.textTracks[0].mode = 'showing'
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                $('video')[0].play()
                $('#dlperc').hide()
                socket.emit('watched', myshow)
                toastr.success(`${batchDone} / ${showLength} Episodes downloaded`)
            } else if (batchDone < showLength) {
                toastr.success(`${batchDone} / ${showLength} Episodes downloaded`)
            } else if (batchDone === showLength) {
                batch = false
                toastr.success('All episodes are downloaded')
            }
            batchDone++
        }

    })
    socket.on('downloading', perc => {
        $('#dlperc').show()
        $('#dlperc > .progress-bar').removeClass('bg-warning')
        $('#dlperc > .progress-bar').removeClass('bg-success')
        $('#dlperc > .progress-bar').addClass('bg-info')
        $('#perblue').width(perc + '%')
        if (perc === 100) {
            $('#dlperc > .progress-bar').removeClass('bg-warning')
            $('#dlperc > .progress-bar').removeClass('bg-danger')
            $('#dlperc > .progress-bar').addClass('bg-success')
            $('#perblue').animate({
                width: "100%"
            }, 1000);
        }
    })
})

function launch_toast() {
    var x = document.getElementById("toast")
    x.className = "show";
    setTimeout(function () {
        x.className = x.className.replace("show", "");
    }, 5000);
}