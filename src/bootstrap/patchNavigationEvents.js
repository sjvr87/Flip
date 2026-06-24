'use strict';

/**
 * expo-router handleNavigationOnReady uses emit from a circular require; on Android tab
 * presses the listener can call undefined emit and throw "undefined is not a function".
 */
function installNavigationEventsPatch() {
    try {
        const navReady = require('expo-router/build/navigationEvents/navigation');
        let flipUnsubscribe;
        navReady.handleNavigationOnReady = function flipPatchedHandleNavigationOnReady() {
            if (flipUnsubscribe) {
                flipUnsubscribe();
            }
            const { storeRef } = require('expo-router/build/global-state/store');
            const navigationRef = storeRef.current?.navigationRef;
            if (!navigationRef || typeof navigationRef.addListener !== 'function') {
                return;
            }
            flipUnsubscribe = navigationRef.addListener('__unsafe_action__', (e) => {
                if (!e.data?.noop && storeRef.current.state) {
                    const { emit } = require('expo-router/build/navigationEvents');
                    if (typeof emit !== 'function') {
                        return;
                    }
                    const action = e.data.action;
                    emit('actionDispatched', {
                        actionType: action.type,
                        payload: action.payload,
                        state: storeRef.current.state,
                    });
                }
            });
        };
    } catch {
        // tests / web
    }
}

module.exports = { installNavigationEventsPatch };
