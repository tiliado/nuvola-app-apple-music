/*
 * Copyright 2020 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  var player = Nuvola.$object(Nuvola.MediaPlayer)

  // Handy aliases
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  var WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    var elms = this._getElements()
    var track = {
      title: Nuvola.queryText('.web-chrome-playback-lcd__song-name-scroll-inner-text-wrapper'),
      artist: null,
      album: null,
      artLocation: null,
      rating: null,
      length: elms.progressbar ? elms.progressbar.getAttribute('aria-valuemax') * 1000000 : null
    }

    if (elms.chrome) {
      var subtitle = elms.chrome.querySelectorAll('.web-chrome-playback-lcd__sub-copy-scroll-inner-text-wrapper a')
      if (!subtitle.length) {
        subtitle = elms.chrome.querySelectorAll('.web-chrome-playback-lcd__sub-copy-scroll-inner-text-wrapper span')
      }
      if (subtitle.length === 2) {
        track.artist = subtitle[0].textContent.trim()
        track.album = subtitle[1].textContent.trim()
      }
      track.artLocation = Nuvola.queryAttribute('div.web-chrome img.media-artwork-v2__image', 'srcset', (src) => {
        if (!src) {
          return null
        }

        var imgs = src.split(',')
        if (!imgs.length) {
          return null
        }

        src = imgs.pop().trim().split(' ')[0].trim()
        return src ? src.replace('/88x88', '/300x300') : null
      })
    }

    var state
    if (!elms.chrome || (!elms.play && !elms.pause)) {
      state = PlaybackState.UNKNOWN
    } else if (elms.chrome.classList.contains('is-playing')) {
      state = PlaybackState.PLAYING
    } else {
      state = PlaybackState.PAUSED
    }
    player.setPlaybackState(state)

    player.setTrack(track)
    player.setPlaybackState(state)

    player.setCanGoPrev(!!elms.prev)
    player.setCanGoNext(!!elms.next)
    player.setCanPlay(!!elms.play)
    player.setCanPause(!!elms.pause)

    var shuffle = elms.shuffle ? elms.shuffle.getAttribute('aria-checked') === 'true' : null
    player.setCanShuffle(shuffle !== null)
    player.setShuffleState(shuffle)

    player.setTrackPosition(elms.progressbar ? elms.progressbar.getAttribute('aria-valuenow') * 1000000 : null)
    player.setCanSeek(state !== PlaybackState.UNKNOWN && elms.progressbar)
    player.updateVolume(elms.volumebar ? elms.volumebar.value * 1 : null)
    player.setCanChangeVolume(!!elms.volumebar)

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    var elms = this._getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        } else {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(elms.play)
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        Nuvola.clickOnElement(elms.pause)
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(elms.prev)
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(elms.next)
        break
      case PlayerAction.SEEK:
        Nuvola.setInputValueWithEvent(elms.progressbar, Math.round(param / 1000000))
        break
      case PlayerAction.CHANGE_VOLUME:
        Nuvola.setInputValueWithEvent(elms.volumebar, param)
        break
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(elms.shuffle)
        break
    }
  }

  WebApp._getElements = function () {
  // Interesting elements
    var elms = {
      chrome: document.querySelector('div.web-chrome'),
      play: null,
      pause: null,
      next: null,
      prev: null,
      repeat: document.getElementById('repeat'),
      shuffle: document.getElementById('shuffle'),
      progressbar: document.querySelector('div.web-chrome .web-chrome-playback-lcd__progress-bar-container input'),
      volumebar: document.querySelector('div.web-chrome .web-chrome-playback-lcd__volume input')
    }

    // Prev, play/pause, next
    var buttons = document.querySelectorAll('.web-chrome-playback-controls__main button')
    if (buttons.length === 3) {
      elms.prev = buttons[0]
      elms.next = buttons[2]
      if (elms.chrome && elms.chrome.classList.contains('is-playing')) {
        elms.pause = buttons[1]
      } else {
        elms.play = buttons[1]
      }
    }

    // Shuffle, repeat
    var checkboxes = document.querySelectorAll('.web-chrome-playback-controls__directionals div[role="checkbox"]')
    if (checkboxes.length === 2) {
      elms.shuffle = checkboxes[0]
      elms.repeat = checkboxes[1]
    }

    // Ignore disabled buttons
    for (var key in elms) {
      if (elms[key] && elms[key].disabled) {
      // console.log("disabled " + key)
        elms[key] = null
      }
    }

    return elms
  }

  WebApp.start()
})(this) // function(Nuvola)
