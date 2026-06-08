// ==UserScript==
// @name         AI Studio Response Ready Ping
// @namespace    http://tampermonkey.net/
// @version      0.10
// @description  Plays an audible ping, when the model response is ready in Google AI Studio.
// @author       igsko
// @match        https://aistudio.google.com/*
// @icon         https://www.gstatic.com/aistudio/ai_studio_favicon_2_32x32.png
// @grant        window.onurlchange
// @license      MIT
// ==/UserScript==

// === CONFIG ===
const DEBUG = true; // enable console debug output for development
const AUDIO_URL = "http://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"; // notification sound file
const VERSION = "0.10";
// ==============

if(DEBUG) console.log(`AI Studio Response Ready Ping v${VERSION}`);
// helper to log only when debug mode is enabled
function log(...args) {
    if(DEBUG) console.log(...args);
}


(function() {
    'use strict';

    const TARGET_TAG = 'ms-thought-chunk';
    const ANIMATION_NAME = 'elementDetected';
    const MARKER_ATTR = 'data-detected-hook';

    let isInitialLoad = true; // state flag
    let loaderHasAppeared = false; 
    let processedElements = new WeakSet(); // cache of handled elements to avoid duplicate work

    // store references to clear/disconnect them during URL transitions
    let loaderObserver = null;
    let fallbackTimeoutId = null;
    let settlingTimeoutId = null;

    function resetLoaderObservation() {
        log('[Detector] --- URL CHANGED: resetting load state ---');

        // Reset state flags
        isInitialLoad = true;
        loaderHasAppeared = false;
        processedElements = new WeakSet(); // clear past element history for the new URL

        // Clear any active timeouts from previous loads
        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        if (settlingTimeoutId) clearTimeout(settlingTimeoutId);

        // Disconnect previous MutationObserver if it is active
        if (loaderObserver) {
            loaderObserver.disconnect();
        }

        // Set up a fresh loader-monitoring observer for the current transition
        loaderObserver = new MutationObserver((mutations, obs) => {
            const loader = document.querySelector('prompt-loader');
            
            if (loader) {
                loaderHasAppeared = true;
            } else if (loaderHasAppeared && !loader) {
                // the loader was active but has now disappeared (transition rendering finished)
                settlingTimeoutId = setTimeout(() => {
                    isInitialLoad = false;
                    log('[Detector] --- URL TRANSITION LOAD COMPLETE ---');
                }, 150);
                
                obs.disconnect(); // stop observing to save performance
            }
        });

        // start observing the DOM again
        loaderObserver.observe(document, { childList: true, subtree: true });

        // set up fallback timeout in case the new URL does not require a loader
        fallbackTimeoutId = setTimeout(() => {
            if (!loaderHasAppeared && !document.querySelector('prompt-loader')) {
                isInitialLoad = false;
                log('[Detector] --- URL TRANSITION LOAD COMPLETE (Fallback) ---');
                if (loaderObserver) {
                    loaderObserver.disconnect();
                }
            }
        }, 3000);
    }

    // Run once for the initial tab load
    resetLoaderObservation();

    // listen for subsequent dynamic URL changes using Tampermonkey API
    if (window.onurlchange === null) { // check if the feature is supported
        window.addEventListener('urlchange', function(info) {
            resetLoaderObservation();
        });
    }

    // ============================
    // TARGETED DESCENDANT WATCHDOG
    // ============================
    /**
     * Watches a specific element's subtree for the appearance of a descendant
     * matching a CSS selector and containing targeted text content.
    */
    function watchForDescendant(parentElement, selector, targetText, callback) {
        function checkPresence() {
            const targetEl = parentElement.querySelector(selector);
            // verify the element exists and contains target text node content
            if (targetEl && targetEl.textContent.includes(targetText)) {
                return true;
            }
            return false;
        }

        console.log('watchForDescendant called');

        // if the descendant is already fully compiled and present, execute immediately
        if (checkPresence()) {
            callback();
            return;
        }

        // create a local MutationObserver to monitor only this element subtree
        const observer = new MutationObserver((mutations, obs) => {
            if (checkPresence()) {
                callback();
                obs.disconnect(); // clean once detected
            }
        });

        observer.observe(parentElement, {
            childList: true,       // detects if <mat-panel-title> gets added
            subtree: true,         // deep search nested children
            characterData: true    // detects changes if text node updates dynamically
        });

        // safety timeout to prevent memory leaks if the text never renders or element is detached
        setTimeout(() => {
            observer.disconnect();
        }, 15000);
    }

    // listen to the event globally
    function onElementCreated(element) {
        // ignore null, already processed, or marked elements
        if (!element || processedElements.has(element) || element.hasAttribute(MARKER_ATTR)) {
            return;
        }
        processedElements.add(element);
        element.setAttribute(MARKER_ATTR, 'true');

        if (isInitialLoad) {
            log('[Detector] [PAGE LOAD] Found element:', element);
        } else {
            log('[Detector] [DYNAMIC] New element appended later:', element);

            // start watching this specific dynamic element for the "Thoughts" header
            watchForDescendant(element, 'mat-panel-title', 'Thoughts', () => {
                log('[Detector] [DYNAMIC] Target text "Thoughts" appeared inside descendant of:', element);
                console.log('Response ready!');
                audio.play().catch((err) => console.warn("Audio play blocked by browser policy. Interaction required."));
            });
        }
    }

    // attach animation listener to detect injected target elements
    document.addEventListener('animationstart', function(event) {
        if (event.animationName === ANIMATION_NAME) {
            onElementCreated(event.target);
        }
    }, true);

    // inject CSS directly onto the html element
    const css = `
        ${TARGET_TAG} { animation: ${ANIMATION_NAME} 0.001s !important; }
        @keyframes ${ANIMATION_NAME} {
            from { outline: 1px solid transparent; }
            to { outline: 1px solid transparent; }
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);

    // Prepare audio element for playback when the response is ready
    const audio = document.createElement("audio");
    audio.src = AUDIO_URL;

})();