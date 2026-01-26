// ==UserScript==
// @name         AI Studio Response Ready Ping
// @namespace    http://tampermonkey.net/
// @version      0.9.1
// @description  Plays an audible ping, when the model response is ready in Google AI Studio.
// @author       igsko
// @match        https://aistudio.google.com/prompts/*
// @icon         https://www.gstatic.com/aistudio/ai_studio_favicon_2_32x32.png
// @grant        window.onurlchange
// @licence      MIT
// ==/UserScript==

// ---- CONFIGURATION ----
const DEBUG = true; // enables debug logging
const AUDIO_URL = "http://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"; // url to the audio file
const VERSION = "0.9.1";

if(DEBUG) console.log(`AI Studio Response Ready Ping v${VERSION}`);
function log(...args) {
    if(DEBUG) console.log(...args);
}

/**
 * sets up an inner observer in a container
 * the observer looks for a specific element that fits
 * all the "Model Response is ready" criteria
 * @param {Element} target - The container to set up an observer on
 */
function setupInnerObserver(target) {
    let hasTriggered = false;

    // observer setup
    const innerObserver = new MutationObserver((mutationList, observer) => {
        if(hasTriggered) return; // stop if we found it already

        const textChunk = target.querySelector('ms-text-chunk');
        const thoughtChunk = target.querySelector('ms-thought-chunk');

        if(textChunk) {
            // Find if the text chunk found is indeed the model response
            // element exists? / is it attatched to the page? / does it have a previous sibling? / does it have a text content?

            // textChunk && textChunk.isConnected && textChunk.previousSibling && textChunk.textContent !== ""
            if(textChunk && textChunk.isConnected && textChunk.textContent !== "" && !textChunk.contains("Expand to view model thoughts")) {
                log("RESPONSE READY!");
                // play sound
                audio.play().catch((err) => console.warn("Audio play blocked by browser policy"));

                // cleanup
                hasTriggered = true;
                observer.disconnect();
            }
        }
        log(target);
    });

    // observer deployment
    innerObserver.observe(target, { childList: true, subtree: true });
}

let activeSessionObserver = null;
let activeZeroStateObserver = null;

/**
 * sets up a main observer on the chat session content container
 * that looks for a container with a turn data attribute set to "Model",
 * which means the AI model responded
 * it then calls setupInnerObserver on it when response found
 */
function setupMainObserver() {

    if(activeSessionObserver){
        log("session observer already active");
        return;
    }

    let chatSessionContent = document.querySelector(".chat-session-content");
    log("Main Observer Session EL: ", chatSessionContent);
    
    // main observer setup:
    // looks for a container with a turn data attribute set to "Model"
    const observerCallback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if(mutation.type === "childList" && mutation.addedNodes.length > 0){
                for (const addedNode of mutation.addedNodes){
                    if(addedNode.nodeType === Node.ELEMENT_NODE){
                        log("is Node.ELEMENT_NODE");
                        const modelPrompt = addedNode.querySelector('[data-turn-role="Model"]');
                        if(modelPrompt) {
                            observer.disconnect();
                            activeSessionObserver = null;
                            log("calling setupInnerObserver...");
                            setupInnerObserver(modelPrompt);
                        }
                    }
                }
            }
        }
    };

    const zeroStateObserverCallback = (mutationList, observer) => {
        for(const mutation of mutationList) {
            if(mutation.type === "childList" && mutation.addedNodes.length > 0){
                for (const addedNode of mutation.addedNodes){
                    if(addedNode.nodeType === Node.ELEMENT_NODE){
                        chatSessionContent = document.querySelector(".chat-session-content");
                        if(chatSessionContent) {
                            log("chatSessionContent found: ", chatSessionContent);
                            observer.disconnect();
                            activeSessionObserver = new MutationObserver(observerCallback);
                            activeSessionObserver.observe(chatSessionContent, { childList: true });
                            return;
                        }
                    }
                }
            }
        }
    }

    // if we are on a new chat
    // set up an observer waiting for the chat session
    // (when zeroState element is removed)
    const zeroState = document.querySelector('ms-zero-state');
    if(zeroState) {
        log('zeroState: ', zeroState);
        activeZeroStateObserver = new MutationObserver(zeroStateObserverCallback);
        activeZeroStateObserver.observe(document.body, { childList: true, subtree: true});
    }
    else {    
        activeSessionObserver = new MutationObserver(observerCallback);
        activeSessionObserver.observe(chatSessionContent, { childList: true });
    }
}

let activeLoadObserver = null

/**
 * sets up a MutationObserver on the document body that looks for a
 * removed element with the local name "prompt-loader",
 * which means the chat session is ready. when found, it
 * triggers the setupMainObserver function and then disconnects the
 * observer.
 */
function setupLoadObserver() {
    console.log('setupLoadObserver');
    if(activeLoadObserver) {
        log("load observer already active");
        return;
    }

    // if the loader is already gone, the chat session is ready.
    // call setupMainObserver immediately
    const existingLoader = document.querySelector('prompt-loader');
    if(!existingLoader) {
        log('prompt-loader not found -triggering main observer immediately');
        setupMainObserver();
        return;
    }

    activeLoadObserver = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if(mutation.type === "childList" && mutation.removedNodes.length > 0) {
                for (const removedNode of mutation.removedNodes){
                    if(removedNode.nodeType === Node.ELEMENT_NODE && removedNode.localName === "prompt-loader"){
                        // the chat session is ready, trigger the main observer
                        log("loadObserver triggered");
                        setupMainObserver();
                        observer.disconnect();
                        activeLoadObserver = null;
                        return;
                    }
                }
            }
        }
    });
    activeLoadObserver.observe(document.body, { childList: true, subtree: true });

    // if prompt-loader is removed in the window between
    // the initial check and observer activation, re-check shortly after
    setTimeout(() => {
        if(!activeLoadObserver) return;
        if(!document.querySelector('prompt-loader')){
            log('prompt-loader removed before observer handled it -triggering main observer');
            setupMainObserver();
            activeLoadObserver.disconnect();
            activeLoadObserver = null;
        }
    }, 50);
}

const audio = document.createElement("audio"); 
audio.src = AUDIO_URL;

(function() {
    'use strict';

    const pathname = window.location.pathname;
    if(pathname.includes('new_chat')) log('NEW CHAT');
    setupLoadObserver();
    window.addEventListener('urlchange', () => {
        const pathname = window.location.pathname;
        if(pathname.includes('new_chat')) log('NEW CHAT');
        setupLoadObserver();
    });
})();