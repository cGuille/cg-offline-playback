(function () {
    "use strict";

    if (!window.customElements) {
        throw new Error('this browser does not support custom elements');
    }

    const PLAY_SYMBOL = '▶';
    const PAUSE_SYMBOL = '⏸';

    const STORAGE_NAME = 'cgop-tracks';
    const STORAGE_VERSION = 1;
    const STORAGE_COLLECTION_FILES = 'files';
    const STORAGE_COLLECTION_TIMES = 'times';
    const STORAGE_COLLECTIONS = [STORAGE_COLLECTION_FILES, STORAGE_COLLECTION_TIMES];

    const STATE_CONSTRUCTED = 'constructed';
    const STATE_INITIALIZED = 'initialized';
    const STATE_PENDING_DOWNLOAD = 'pending-download';
    const STATE_DOWNLOADING = 'downloading';
    const STATE_DOWNLOADED = 'downloaded';
    const STATE_LOADING = 'loading';
    const STATE_PLAYING = 'playing';
    const STATE_PAUSED = 'paused';
    const STATES = [STATE_CONSTRUCTED, STATE_INITIALIZED, STATE_PENDING_DOWNLOAD, STATE_DOWNLOADING, STATE_DOWNLOADED, STATE_LOADING, STATE_PLAYING, STATE_PAUSED];

    class TrackElement extends HTMLElement {
        constructor() {
            super();
            setState.call(this, 'constructed');

            this.audioPlayer = document.createElement('audio');

            initContent.call(this);

            initStorage.call(this).then(() => {
                if (!this.downloaded) {
                    initDownload.call(this);
                }
            });
        }

        play() {
            if (!this.audioPlayer.src) {
                throw new Error('trying to play a track which does not have any "src" attribute');
            }

            setState.call(this, STATE_LOADING);

            return this.audioPlayer.play().then(() => {
                setState.call(this, STATE_PLAYING);
                this.playPauseButton.textContent = PAUSE_SYMBOL;
                this.dispatchEvent(new CustomEvent('play'));
            });
        }

        pause() {
            this.audioPlayer.pause();
            setState.call(this, STATE_PAUSED);
            this.playPauseButton.textContent = PLAY_SYMBOL;
            this.dispatchEvent(new CustomEvent('pause'));
        }

        get key() {
            return trimmedAttributeValue.call(this, 'key');
        }

        get label() {
            return trimmedAttributeValue.call(this, 'label');
        }

        get url() {
            return trimmedAttributeValue.call(this, 'url');
        }

        get pendingDownload() {
            return this.hasAttribute(STATE_PENDING_DOWNLOAD);
        }

        get downloading() {
            return this.hasAttribute(STATE_DOWNLOADING);
        }

        get downloaded() {
            return this.hasAttribute(STATE_DOWNLOADED);
        }

        get playing() {
            return this.hasAttribute(STATE_PLAYING);
        }

        get paused() {
            return this.hasAttribute(STATE_PAUSED);
        }
    }

    function initContent() {
        this.attachShadow({ mode: 'open' });

        const main = document.createElement('main');

        const style = document.createElement('style');
        style.textContent = getStyle.call(this);
        main.appendChild(style);

        const heading = document.createElement('h1');
        heading.textContent = this.label;
        main.appendChild(heading);

        this.controls = document.createElement('section');

        this.downloadProgressElt = document.createElement('progress');
        this.downloadProgressElt.classList.add('dl-progressbar');

        this.playPauseButton = document.createElement('button');
        this.playPauseButton.textContent = PLAY_SYMBOL;
        this.playPauseButton.addEventListener('click', togglePlayPause.bind(this), false);

        this.currentTimeElt = document.createElement('span');
        this.currentTimeElt.classList.add('timedisplay');

        main.appendChild(this.controls);

        this.shadowRoot.appendChild(main);
    }

    function initStorage() {
        const storage = new Storage(STORAGE_NAME, STORAGE_VERSION, STORAGE_COLLECTIONS);

        return storage.open().then(() => {
            this.files = storage.getCollection(STORAGE_COLLECTION_FILES);
            this.times = storage.getCollection(STORAGE_COLLECTION_TIMES);
            setState.call(this, STATE_INITIALIZED);

            return this.files.fetch(this.key).then(blob => {
                if (!blob) {
                    setState.call(this, STATE_PENDING_DOWNLOAD);
                    return;
                }

                setUpAudioPlayer.call(this, blob);
            });
        });
    }

    function initDownload() {
        this.ajaxDownload = new AjaxDownload(this.url);

        this.ajaxDownload.addEventListener('progress', () => {
            const progress = this.ajaxDownload.progress;
            if (!progress.computable) {
                return;
            }

            this.downloadProgressElt.setAttribute('value', progress.loaded);
            this.downloadProgressElt.setAttribute('max', progress.total);
        }, false);

        this.addEventListener('click', event => {
            if (!this.pendingDownload) {
                return;
            }

            const confirmMessage = getDownloadConfirmMessage.call(this);
            confirmPopin(confirmMessage).then(confirmation => {
                if (!confirmation || !this.pendingDownload) {
                    return;
                }

                setState.call(this, STATE_DOWNLOADING);

                this.controls.innerHTML = '';
                this.controls.appendChild(this.downloadProgressElt);

                this.ajaxDownload.fetch().then(blob => {
                    this.files.put(this.key, blob).then(() => setUpAudioPlayer.call(this, blob));
                });
            });
        }, false);
    }

    function setUpAudioPlayer(blob) {
        this.audioPlayer.src = window.URL.createObjectURL(blob);

        this.audioPlayer.addEventListener('timeupdate', event => {
            this.times.put(this.key, this.audioPlayer.currentTime);
            this.currentTimeElt.textContent = humanReadableTime(this.audioPlayer.currentTime) + ' / ' + humanReadableTime(this.audioPlayer.duration);;
        }, false);

        return this.times.fetch(this.key).then(time => {
            if (time) {
                this.audioPlayer.currentTime = time;
            }
            setPlayableControls.call(this);
            setState.call(this, STATE_DOWNLOADED);
        });
    }

    function setPlayableControls() {
        this.controls.innerHTML = '';
        this.controls.appendChild(this.playPauseButton);
        this.controls.appendChild(this.currentTimeElt);
    }

    function togglePlayPause() {
        if (!this.playing) {
            this.play();
        } else {
            this.pause();
        }
    }

    function getStyle() {
        return `
main {
    padding-left: 10px;
}
h1 {
    font-size: 1.2em;
    font-weight: normal;
}
section {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
}
section :first-child {
    margin-right: 1em;
}
.dl-progressbar {
    border: 1px solid var(--secondary-color, black);
    width: 100%;
}
.dl-progressbar::-webkit-progress-bar {
    background: transparent;
}
.dl-progressbar::-webkit-progress-value {
    background: var(--secondary-color, black);
}
.dl-progressbar::-moz-progress-bar {
    background: var(--secondary-color, black);
}

button {
    background: var(--text-color);
    border: 1px solid var(--secondary-color, black);
    color: var(--main-color);
    font-size: 1.5em;
    height: 100%;
    outline: none;
    padding: 0.2em 0.5em;
}
.timedisplay {
    font-size: 1.6em;
    white-space: nowrap;
}
`;
    }

    function getDownloadConfirmMessage() {
        return `Souhaitez-vous lancer le téléchargement de ce fichier ?

« ${this.label} »

Cette opération est déconseillée depuis les réseaux mobiles.`;
    }

    function confirmPopin(message) {
        return new Promise(resolve => {
            setTimeout(() => resolve(window.confirm(message)), 0);
        });
    }

    function trimmedAttributeValue(attributeName) {
        const attr = this.getAttribute(attributeName);
        return attr ? attr.trim() : null;
    }

    function setBooleanAttributeValue(attributeName, isEnabled) {
        if (isEnabled) {
            this.setAttribute(attributeName, '');
        } else {
            this.removeAttribute(attributeName);
        }
    }

    function setState(newState) {
        STATES.forEach(state => setBooleanAttributeValue.call(this, state, state === newState));
    }

    function humanReadableTime(timeInSeconds) {
        let result = '';
        let seconds = Math.round(timeInSeconds);

        const hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;

        const minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;

        if (hours) {
            result += hours + 'h ';
        }

        if (minutes) {
            result += minutes + 'm ';
        }

        result += seconds + 's';

        return result;
    }

    const elementStyle = document.createElement('style');
    elementStyle.textContent = `
cgop-track {
  display: block;
  margin: 0;
  padding: 10px;
  transition: background-color 150ms ease-in-out;
}
cgop-track:not(:last-of-type) {
  border-bottom: 1px solid var(--secondary-color);
}

cgop-track[playing] {
  background-color: var(--main-color);
  color: var(--text-color);
}
`;
    document.body.appendChild(elementStyle);

    window.customElements.define('cgop-track', TrackElement);
}());
