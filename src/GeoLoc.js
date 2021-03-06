// GeoLoc.js

var global = typeof window == 'undefined' ? global : window;
var uidCounter = 0;

var defaultProviders = [];

/**
 * @class {GeoLoc}
 *
 * @example
 * // Get with the default providers
 * GeoLoc
 *     .getPosition(function(err, pos) {
 *         console.log(pos);
 *     });
 *
 * @example
 * // Use provider
 * GeoLoc
 *     .use([GeoLoc.providers['html5geolocation']])
 *     .getPosition(function(err, pos) {
 *         console.log(pos);
 *     });
 *
 * @param {Object} [options]
 * @param {int} [providerTimeout=10000]
 * @param {int} [maximumAge=1000*60*60*24]
 * @param {Array<GeoLoc.Provider>} [options.providers]
 */
function GeoLoc(options) {
	if (!options) {
		options = {};
	}

	if (options.providerTimeout) {
		this.providerTimeout = options.providerTimeout;
	}

	if (options.maximumAge) {
		this.maximumAge = options.maximumAge;
	}

	this.providers = options.providers || defaultProviders;
}

/**
 * @type {Object<GeoLoc.Provider>}
 */
GeoLoc.providers = {};

/**
 * @param {Array<GeoLoc.Provider>} providers
 * @returns {Function}
 */
GeoLoc.setDefaultProviders = function(providers) {
	defaultProviders = providers;
	return GeoLoc;
};

/**
 * @param {Array<GeoLoc.Provider>} providers
 * @returns {GeoLoc}
 */
GeoLoc.use = function(providers) {
	return new GeoLoc({ providers: providers });
};

/**
 * @param {Object} [options]
 * @param {int} [providerTimeout=10000]
 * @param {int} [maximumAge=1000*60*60*24]
 * @param {Array<GeoLoc.Provider>} [options.providers]
 * @param {Function} cb
 * @returns {GeoLoc}
 */
GeoLoc.getPosition = function(options, cb) {
	return new GeoLoc().getPosition(options, cb);
};

/**
 * @lends GeoLoc#
 */
GeoLoc.prototype = {
	constructor: GeoLoc,

	providerTimeout: 10000,

	maximumAge: 1000 * 60 * 60 * 24,

	providers: null,

	/**
	 * @param {Array<GeoLoc.Provider>} providers
	 * @returns {GeoLoc}
	 */
	use: function(providers) {
		this.providers = providers;
		return this;
	},

	/**
	 * @private
	 */
	_getPositionFromLocalStorage: function(maximumAge) {
		var storedData = localStorage.getItem('_GeoLocData');

		if (storedData) {
			storedData = storedData.split(',');

			var timeStamp = Number(storedData[2]);

			if (Date.now() - timeStamp <= maximumAge) {
				return {
					latitude: Number(storedData[0]),
					longitude: Number(storedData[1])
				};
			}
		}

		return null;
	},

	/**
	 * @param {Object} [options]
	 * @param {int} [providerTimeout=10000]
	 * @param {int} [maximumAge=1000*60*60*24]
	 * @param {Array<GeoLoc.Provider>} [options.providers]
	 * @param {Function} cb
	 * @returns {GeoLoc}
	 */
	getPositionParallel: function(options, cb) {
		if (typeof options == 'function') {
			cb = options;
			options = {};
		}

		var pos = this._getPositionFromLocalStorage(options.maximumAge || this.maximumAge);

		if (pos) {
			cb(null, pos);
			return this;
		}

		var providerTimeout = options.providerTimeout || this.providerTimeout;
		var providers = options.providers || this.providers;

		var requests = {};

		function abortAllRequests() {
			for (var id in requests) {
				requests[id].abort();
				delete requests[id];
			}
		}

		function hasRequests() {
			for (var any in requests) {
				return true;
			}
			return false;
		}


		function setData(provider) {
			var req = provider.getPosition(function(err, data) {
				delete requests[req._GeoLoc_id];

				if (err) {
					if (!hasRequests()) {
						cb(err, null);
					}
				} else {
					if (typeof data.latitude != 'number' || typeof data.longitude != 'number') {
						if (!hasRequests()) {
							cb(new TypeError('Incorrect data'), null);
						}
					} else {
						abortAllRequests();

						localStorage.setItem('_GeoLocData', [
							data.latitude,
							data.longitude,
							Date.now()
						].join(','));

						cb(null, data);
					}
				}
			}, { timeout: providerTimeout });

			req._GeoLoc_id = ++uidCounter;

			requests[req._GeoLoc_id] = req;
		}

		for (var i = 0, max = providers.length; i < max; i++) {
			setData(providers[i]);
		}

		return this;
	},

	/**
	 * @param {Object} [options]
	 * @param {int} [providerTimeout=10000]
	 * @param {int} [maximumAge=1000*60*60*24]
	 * @param {Array<GeoLoc.Provider>} [options.providers]
	 * @param {Function} cb
	 * @returns {GeoLoc}
	 */
	getPosition: function(options, cb) {
		if (typeof options == 'function') {
			cb = options;
			options = {};
		}

		var pos = this._getPositionFromLocalStorage(options.maximumAge || this.maximumAge);

		if (pos) {
			cb(null, pos);
			return this;
		}

		var providerTimeout = options.providerTimeout || this.providerTimeout;
		var providers = options.providers || this.providers;

		(function getPosition(providers) {
			var provider = providers.shift();

			provider.getPosition(function(err, data) {
				if (err) {
					if (providers.length) {
						getPosition(providers);
					} else {
						cb(err, null);
					}
				} else {
					if (typeof data.latitude != 'number' || typeof data.longitude != 'number') {
						if (providers.length) {
							getPosition(providers);
						} else {
							cb(new TypeError('Incorrect data'), null);
						}
					} else {
						localStorage.setItem('_GeoLocData', [
							data.latitude,
							data.longitude,
							Date.now()
						].join(','));

						cb(null, data);
					}
				}
			}, { timeout: providerTimeout });
		})(this.providers.slice(0));

		return this;
	}
};

if (typeof exports != 'undefined') {
	if (typeof module != 'undefined' && module.exports) {
		module.exports = GeoLoc;
	} else {
		exports.GeoLoc = GeoLoc;
	}
} else {
	global.GeoLoc = GeoLoc;
}
