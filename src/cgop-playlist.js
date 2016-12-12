(function () {
    "use strict";

    if (!window.customElements) {
        throw new Error('this browser does not support custom elements');
    }

    class PlaylistElement extends HTMLElement {
        constructor() {
            super();

            this.currentTrack = null;

            this.addEventListener('play', event => {
                const currentTrack = event.target;

                if (this.currentTrack && this.currentTrack !== currentTrack) {
                    this.currentTrack.pause();
                }

                this.currentTrack = currentTrack;
            }, true);
        }
    }

    window.customElements.define('cgop-playlist', PlaylistElement);
}());
