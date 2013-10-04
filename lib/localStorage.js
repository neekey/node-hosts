// http://www.rajdeepd.com/articles/chrome/localstrg/LocalStorageSample.htm

// NOTE:
// this varies from actual localStorage in some subtle ways
var FS = require( 'fs' );
var PATH = require( 'path' );

(function () {
    "use strict";

    var db;
    var HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    var LOCAL_DATA_PATH = PATH.resolve( HOME, '.localStorage.json' );

    if( !FS.existsSync( LOCAL_DATA_PATH ) ){
        FS.writeFileSync( LOCAL_DATA_PATH, JSON.stringify({}));
    }

    var LOCAL_DATA = require( LOCAL_DATA_PATH );

    /**
     * Save memory Data to File system.
     */
    function saveLocalData(){
        FS.writeFileSync( LOCAL_DATA_PATH, JSON.stringify( LOCAL_DATA ) );
    }

    function LocalStorage() {
    }
    db = LocalStorage;

    db.prototype.getItem = function (key) {
        return LOCAL_DATA[ key ];
    };

    db.prototype.setItem = function (key, val) {
        LOCAL_DATA[key] = String(val);
        saveLocalData();
    };

    db.prototype.removeItem = function (key) {
        delete LOCAL_DATA[key];
        saveLocalData();
    };

    db.prototype.clear = function () {
        var self = this;
        LOCAL_DATA = {};
        saveLocalData();
    };

    db.prototype.key = function (i) {
        i = i || 0;
        return Object.keys(LOCAL_DATA)[i];
    };

    db.prototype.__defineGetter__('length', function () {
        return Object.keys(LOCAL_DATA).length;
    });

    if (global.localStorage) {
        module.exports = localStorage;
    } else {
        module.exports = new LocalStorage();
    }
}());
