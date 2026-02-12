// ==UserScript==
// @name         AI Studio Response Ready Ping
// @namespace    http://tampermonkey.net/
// @version      0.9.2
// @description  Plays an audible ping, when the model response is ready in Google AI Studio.
// @author       igsko
// @match        https://aistudio.google.com/prompts/*
// @icon         https://www.gstatic.com/aistudio/ai_studio_favicon_2_32x32.png
// @grant        window.onurlchange
// @license      MIT
// ==/UserScript==

// ---- CONFIGURATION ----
const DEBUG = true; // enables debug logging
const AUDIO_URL = "http://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"; // url to the audio file
const VERSION = "0.9.2";

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

    // target is the [data-turn-role="Model"] div
    // the footer with buttons is a sibling of this div inside the turn container
    const turnContainer = target.closest('.chat-turn-container');
    log("Inner Observer Turn EL: ", turnContainer);

    // observer setup
    const innerObserver = new MutationObserver((mutationList, observer) => {
        if(hasTriggered) return; // stop if we found it already

        const feedbackButton = turnContainer.querySelector('.response-feedback-button');

        if(feedbackButton) {
            log("RESPONSE READY!");
            // play audio
            audio.play().catch((err) => console.warn("Audio play blocked by browser policy. Interaction required."));

            // cleanup
            hasTriggered = true;
            observer.disconnect();
        }
    });

    // observer deployment
    innerObserver.observe(turnContainer, { childList: true, subtree: true });
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
                        //log("is Node.ELEMENT_NODE: ", addedNode);
                        let modelTurn = null;

                        // check if added node is the model turn
                        if(addedNode.matches && addedNode.matches('[data-turn-role="Model"]')){
                            modelTurn = addedNode;
                        } 
                        // Check if added node contains the model turn
                        else if(addedNode.querySelector) {
                            modelTurn = addedNode.querySelector('[data-turn-role="Model"]');
                        }

                        if(modelTurn && !modelTurn.dataset.pingObserved) {
                            log("New model turn detected:", modelTurn);
                            modelTurn.dataset.pingObserved = true;
                            setupInnerObserver(modelTurn);
                        }
                    }
                }
            }
        }
    };

    const zeroStateObserverCallback = (mutationList, observer) => {
        for(const mutation of mutationList) {
            if(mutation.type === "childList" && mutation.addedNodes.length > 0){
                const foundContent = document.querySelector(".chat-session-content");

                if(foundContent){
                    log("chatSessionContent detected: ", foundContent);
                    observer.disconnect();

                    // check immediately if it was added in the same batch
                    const existingModelTurn = foundContent.querySelector('[data-turn-role="Model"]');
                    if(existingModelTurn) {
                        // log("Model turn present already, skipping observer: ", existingModelTurn);
                        log("Model turn present already, continuing: ", existingModelTurn);
                        setupInnerObserver(existingModelTurn);
                        // return;
                    }

                    activeSessionObserver = new MutationObserver(observerCallback);
                    activeSessionObserver.observe(foundContent, { childList: true, subtree: true });
                    return;
                }
            }
        }
    }


    // scenario 1: we are on the new chat 
    const zeroState = document.querySelector('ms-zero-state');
    if(zeroState) {
        log('zeroState active - waiting for user to start chat: ', zeroState);
        activeZeroStateObserver = new MutationObserver(zeroStateObserverCallback);
        activeZeroStateObserver.observe(document.body, { childList: true, subtree: true});
    }
    // scenario 2: we are on an existing chat
    else if (chatSessionContent){
        log("existing chat session already present: ", chatSessionContent);

        // start the listener for future model turns
        activeSessionObserver = new MutationObserver(observerCallback);
        activeSessionObserver.observe(chatSessionContent, { childList: true, subtree: true });

        // get all model turns 
        // look at just the last one and tag it so we don't double trigger
        const existingModelTurns = chatSessionContent.querySelectorAll('[data-turn-role="Model"]');
        if(existingModelTurns.length > 0) {
            const lastModelTurn = existingModelTurns[existingModelTurns.length - 1];
            if(!lastModelTurn.dataset.pingObserved) {
                lastModelTurn.dataset.pingObserved = true;
                setupInnerObserver(lastModelTurn);
            }
        }
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