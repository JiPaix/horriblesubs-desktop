$('document').ready(() => {
	toastr.options.positionClass = 'toast-bottom-center'
	toastr.options.preventDuplicates = true
	toastr.options.newestOnTop = true
	let download = false
	let batch = false
	let batchDone = 1
	let showLength = JSON.parse($('#dlall').attr('data')).links.length
	$('#dlall').click(function(e) {
		batch = true
		$('#dlall').fadeOut(1000)
		$('#dlperc').show()
		ipc.send('download all', JSON.parse($(this).attr('data')))
	})
	$('#MAL').click(function(e) {
		ipc.send('data-search', {
			name: $(this).attr('data'),
			keyword: $(this).attr('data')
		})
	})
	$('#followthis').click(function(e) {
		if ($(this).hasClass('follow')) {
			ipc.send('follow', myshow.id)
			$(this).html('UNFOLLOW')
		} else {
			ipc.send('unfollow', myshow.id)
			$(this).html('FOLLOW')
		}
		$(this).toggleClass('follow unfollow')
		$(this).toggleClass('btn-warning btn-danger')
	})
	$('button.ep').click(function(e) {
		if (batch === true) {
			toastr.warning('Episodes are still downloading, wait until the end')
		} else if (download === true) {
			toastr.warning('An episode is still downloading, please wait.')
		} else {
			$('#dlperc > .progress-bar').addClass('bg-warning')
			$('#dlperc > .progress-bar').removeClass('bg-danger')
			$('#perblue').animate(
				{
					width: '100%',
				},
				1000
			)
			myshow.ep = parseFloat($(this).attr('data-ep'))
			ipc.send('watch', {
				ep: $(this).attr('data-ep'),
				name: myshow.name,
				bot: $(this).attr('data-bot'),
				pack: $(this).attr('data-pack'),
			})
			download = true
			$(this).removeClass('btn-danger btn-secondary')
			$(this).addClass('btn-danger')
		}
	})

	ipc.on('nobatch', () => {
		$('#dlperc > .progress-bar').removeClass('bg-warning')
		$('#dlperc > .progress-bar').removeClass('bg-info')
		$('#dlperc > .progress-bar').removeClass('bg-success')
		$('#dlperc > .progress-bar').addClass('bg-danger')
		$('#perblue').animate(
			{
				width: '100%',
			},
			1000
		)
		$('#dlperc').show()
		batch = false
	})

	ipc.on('watch', (_ev, fileInfo) => {
		if (!batch) {
			file = path.parse(fileInfo.file).name
			file = path.join(videoPath + '/' + file)
			$('#player').attr('src', 'file:///' + file + '.mkv')
			$('#track').attr('src', 'file:///' + file + '.vtt')
			let video = document.querySelector('video.embed-responsive-16by9')
			$('video')[0].load()
			$('#dlperc').hide()
			$('main').animate({ scrollTop: 0 }, 'slow')
			$('video')[0]
				.play()
				.then(() => {
					video.textTracks[0].mode = 'showing'
					$('#dlperc').hide()
					$('#perblue').width('0%')
					ipc.send('watched', myshow)
					download = false
				})
		} else {
			if (batchDone === 1) {
				file = path.parse(fileInfo.file).name
				file = path.join(videoPath + '/' + file)
				$('#player').attr('src', 'file:///' + file + '.mkv')
				$('#track').attr('src', 'file:///' + file + '.vtt')
				let video = document.querySelector('.embed-responsive-16by9')
				$('video')[0].load()
				$('#dlperc').hide()
				$('main').animate({ scrollTop: 0 }, 'slow')
				$('video')[0]
					.play()
					.then(() => {
						video.textTracks[0].mode = 'showing'
						ipc.send('watched', myshow)
						toastr.success(
							`${batchDone} / ${showLength} Episodes downloaded`
						)
					})
			} else if (batchDone < showLength) {
				toastr.success(
					`${batchDone} / ${showLength} Episodes downloaded`
				)
			} else if (batchDone === showLength) {
				batch = false
				toastr.success('All episodes are downloaded')
			}
			batchDone++
		}
	})
	ipc.on('downloading', (_ev, perc) => {
		$('#dlperc').show()
		$('#dlperc > .progress-bar').removeClass('bg-warning')
		$('#dlperc > .progress-bar').removeClass('bg-success')
		$('#dlperc > .progress-bar').addClass('bg-info')
		$('#perblue').width(perc + '%')

		if (perc === 100) {
			$('#dlperc > .progress-bar').removeClass('bg-warning')
			$('#dlperc > .progress-bar').removeClass('bg-danger')
			$('#dlperc > .progress-bar').addClass('bg-success')
			$('#perblue').animate(
				{
					width: '100%',
				},
				1000
			)
		}
	})
})

function launch_toast() {
	var x = document.getElementById('toast')
	x.className = 'show'
	setTimeout(function() {
		x.className = x.className.replace('show', '')
	}, 5000)
}
