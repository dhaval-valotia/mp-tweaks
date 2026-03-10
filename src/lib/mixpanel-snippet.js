// @ts-nocheck
// https://github.com/mixpanel/mixpanel-js/blob/master/dist/mixpanel-with-recorder.min.js

if (!window.MIXPANEL_WAS_INJECTED) {
	window.MIXPANEL_WAS_INJECTED = true;
	console.log("mp-tweaks: injecting mixpanel snippet");

	// Save real MutationObserver and replace with no-op to prevent Walnut's rrweb from running
	var __REAL_MO = window.MutationObserver;
	window.MutationObserver = function FakeMutationObserver() {
		console.log("[mp-tweaks] blocked Walnut MutationObserver creation");
	};
	window.MutationObserver.prototype.observe = function() {};
	window.MutationObserver.prototype.disconnect = function() {};
	window.MutationObserver.prototype.takeRecords = function() { return []; };

	// If mixpanel already exists on the page, save a ref and nuke it
	if (window.mixpanel) {
		console.log("mp-tweaks: existing mixpanel found, saving ref and replacing");
		window.__WALNUT_MIXPANEL = window.mixpanel;
	}
	window.mixpanel = [];

	// No-op recorder class — Walnut's SDK gets this instead of the real one
	var NoopRecorder = function() { console.log('[mp-tweaks] NoopRecorder instantiated (blocking Walnut)'); };
	NoopRecorder.prototype.startRecording = function() {};
	NoopRecorder.prototype.stopRecording = function() {};
	NoopRecorder.prototype.resumeRecording = function() { return Promise.resolve(null); };
	NoopRecorder.prototype.resetRecording = function() {};
	NoopRecorder.prototype.getActiveReplayId = function() { return null; };
	Object.defineProperty(NoopRecorder.prototype, 'replayId', { get: function() { return null; } });

	// Gate __mp_recorder: intercept writes from the recorder IIFE, return NoopRecorder unless unlocked
	var __savedRecorderClass = null;
	Object.defineProperty(window, '__mp_recorder', {
		get: function() {
			if (window.__mp_tweaks_unlock_recorder) {
				return __savedRecorderClass;
			}
			return NoopRecorder;
		},
		set: function(val) {
			if (val && val !== NoopRecorder && typeof val === 'function') {
				__savedRecorderClass = val;
				console.log('[mp-tweaks] intercepted real __mp_recorder class');
			}
		},
		configurable: true,
		enumerable: true
	});

	// Periodically try to stop Walnut's vendor-bundled rrweb recording
	// Their Mixpanel instance may initialize AFTER ours
	var walnutKillAttempts = 0;
	var walnutKillInterval = setInterval(function() {
		walnutKillAttempts++;
		// Check saved reference
		if (window.__WALNUT_MIXPANEL && window.__WALNUT_MIXPANEL.stop_session_recording) {
			try {
				window.__WALNUT_MIXPANEL.stop_session_recording();
				console.log("[mp-tweaks] stopped Walnut recording via saved ref");
				clearInterval(walnutKillInterval);
				return;
			} catch (e) {}
		}
		// Also check for any named instances Walnut might create
		if (window.mixpanel && window.mixpanel._i && window.mixpanel._i.length > 0) {
			// Check all initialized instances
			for (var key in window.mixpanel) {
				if (window.mixpanel[key] && key !== 'mp_tweaks' && window.mixpanel[key].stop_session_recording) {
					try {
						window.mixpanel[key].stop_session_recording();
						console.log("[mp-tweaks] stopped recording on instance: " + key);
					} catch (e) {}
				}
			}
		}
		if (walnutKillAttempts >= 30) {
			clearInterval(walnutKillInterval);
			console.log("[mp-tweaks] gave up trying to stop Walnut recording after 30 attempts");
		}
	}, 2000);

	const MIXPANEL_CUSTOM_LIB_URL = "https://devbox-5145.devbox.mixpanel.org/libs/mixpanel-js/build/mixpanel.js";
	const MIXPANEL_CUSTOM_RECORDER_URL = "https://devbox-5145.devbox.mixpanel.org/libs/mixpanel-js/build/mixpanel-recorder.js";

	// Load the custom recorder FIRST, then load the main SDK.
	// This ensures window.__mp_recorder is set before the SDK tries to load the recorder from CDN.
	var recorderScript = document.createElement("script");
	recorderScript.type = "text/javascript";
	recorderScript.src = MIXPANEL_CUSTOM_RECORDER_URL;
	console.log("mp-tweaks: loading custom recorder from " + MIXPANEL_CUSTOM_RECORDER_URL);
	recorderScript.addEventListener('load', function() {
		console.log("mp-tweaks: custom recorder loaded, real class intercepted=" + !!__savedRecorderClass);
		// Restore real MutationObserver before our SDK loads
		window.MutationObserver = __REAL_MO;
		console.log("[mp-tweaks] restored real MutationObserver for our rrweb");
		loadMainSDK();
	});
	recorderScript.addEventListener('error', function() {
		console.error("mp-tweaks: FAILED to load custom recorder");
		window.MutationObserver = __REAL_MO;
		console.log("[mp-tweaks] restored real MutationObserver (recorder load failed)");
		loadMainSDK();
	});
	document.head.appendChild(recorderScript);

	function loadMainSDK() {
		(function (f, b) {
			if (!b.__SV) {
				var e, g, i, h;
				window.mixpanel = b;
				b._i = [];
				b.init = function (e, f, c) {
					function g(a, d) {
						var b = d.split(".");
						2 == b.length && ((a = a[b[0]]), (d = b[1]));
						a[d] = function () {
							a.push([d].concat(Array.prototype.slice.call(arguments, 0)));
						};
					}
					var a = b;
					"undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel");
					a.people = a.people || [];
					a.toString = function (a) {
						var d = "mixpanel";
						"mixpanel" !== c && (d += "." + c);
						a || (d += " (stub)");
						return d;
					};
					a.people.toString = function () {
						return a.toString(1) + ".people (stub)";
					};
					i =
						"disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(
							" "
						);
					for (h = 0; h < i.length; h++) g(a, i[h]);
					var j = "set set_once union unset remove delete".split(" ");
					a.get_group = function () {
						function b(c) {
							d[c] = function () {
								call2_args = arguments;
								call2 = [c].concat(Array.prototype.slice.call(call2_args, 0));
								a.push([e, call2]);
							};
						}
						for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++)
							b(j[c]);
						return d;
					};
					b._i.push([e, f, c]);
				};
				b.__SV = 1.2;
				e = f.createElement("script");
				e.type = "text/javascript";
				e.async = !0;
				e.src = MIXPANEL_CUSTOM_LIB_URL;
				console.log("mp-tweaks: loading custom mixpanel lib from " + MIXPANEL_CUSTOM_LIB_URL);
				e.addEventListener('load', function() {
					console.log("mp-tweaks: custom mixpanel library loaded successfully from " + MIXPANEL_CUSTOM_LIB_URL);
				});
				e.addEventListener('error', function() {
					console.error("mp-tweaks: FAILED to load custom mixpanel library from " + MIXPANEL_CUSTOM_LIB_URL);
				});
				g = f.getElementsByTagName("script")[0];
				g.parentNode.insertBefore(e, g);
			}
		})(document, window.mixpanel || []);
		console.log("mp-tweaks: mixpanel snippet injected! awaiting init()");
	}
}
else {
	console.log("mp-tweaks: mixpanel already injected");
}
