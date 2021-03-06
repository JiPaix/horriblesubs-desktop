$('document').ready(() => {
	const path = require('path')
	toastr.options.positionClass = 'toast-bottom-center'
	toastr.options.preventDuplicates = true
	toastr.options.newestOnTop = true
	let myshow
	let downloading = false
	$('#index').on('click', '.col-2 > a', function(e) {
		if (downloading === false) {
			myshow = JSON.parse($(this).attr('data'))
			$('#dlperc').show()
			$('#dlperc > .progress-bar').addClass('bg-warning')
			$('#perblue').animate(
				{
					width: '100%',
				},
				1000
			)
			ipc.send('watchFromIndex', myshow)
			downloading = true
		} else {
			toastr.warning(
				`${myshow.name} #${myshow.ep}`,
				`Wait for your download to complete :`
			)
		}
	})

	ipc.on('watch', (_ev, fileInfo) => {
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
				downloading = false
			})
	})
	ipc.on('downloading', (_ev, perc) => {
		downloading = true
		$('#perblue').width(perc + '%')
		$('#dlperc > .progress-bar').removeClass('bg-warning')
		$('#dlperc > .progress-bar').addClass('bg-info')
		if (perc === 100) {
			$('#dlperc > .progress-bar').removeClass('bg-warning')
			$('#dlperc > .progress-bar').addClass('bg-success')
			$('#perblue').animate(
				{
					width: '100%',
				},
				1000
			)
		}
	})
	ipc.on('addIndex', (_ev, todo) => {
		let parent = document.createElement('div')
		parent.className = 'col-2 px-1 mb-4 text-center'
		let a = document.createElement('a')
		a.className = 'text-decoration-none card text-white'
		if (allFollows.includes(todo.id)) {
			a.setAttribute(
				'style',
				'min-height:100%;border: 1px solid rgb(0, 0, 0);-webkit-box-shadow: 5px 5px 5px 0px rgba(255,255,255,0.5);transition-duration: 0.3s;'
			)
		} else {
			a.setAttribute(
				'style',
				'min-height:100%;border: 1px solid rgb(0, 0, 0);-webkit-box-shadow: 5px 5px 5px 0px rgba(0,0,0,0.75);transition-duration: 0.3s;'
			)
		}
		a.setAttribute('data', JSON.stringify(todo))
		let embed = document.createElement('div')
		embed.className = 'embed-responsive embed-responsive-1by1'
		embed.setAttribute('style', 'padding-top: 50%;')
		let img = document.createElement('img')
		img.className = 'card-image-top embed-responsive-item'
		img.src = todo.img
		img.setAttribute('style', 'object-fit:cover')
		let card = document.createElement('div')
		card.className = 'card-body bg-dark p-1'
		let cardtitle = document.createElement('h5')
		cardtitle.className = 'card-title mb-1'
		cardtitle.setAttribute(
			'style',
			'overflow: hidden;white-space: nowrap;text-overflow: ellipsis;'
		)
		let cardtext = document.createTextNode(todo.name)
		let small = document.createElement('small')
		small.className = 'card-text text-white-50'
		let smalltext = document.createTextNode(`Episode: ${todo.ep}`)
		cardtitle.appendChild(cardtext)
		small.appendChild(smalltext)
		card.appendChild(cardtitle)
		card.appendChild(small)
		embed.appendChild(img)
		a.appendChild(embed)
		a.appendChild(card)
		parent.appendChild(a)
		let row = document.querySelector('div.row.mt-4')
		row.prepend(parent)
		if (allFollows.includes(todo.id)) {
			toastr.info(`Episode ${todo.ep}`, `${todo.name}`, {
				timeOut: 0,
			})
		} else {
			toastr.info(`Episode ${todo.ep}`, `${todo.name}`, {
				timeOut: 5000,
			})
		}

	})
	$('#index').on('contextmenu', '.col-2 > a', function(e) {
		$('#blackout').show()
		let clicked = JSON.parse($(this).attr('data'))
		window.location.href = 'pug://shows/' + clicked.showLink
		return false
	})
})
