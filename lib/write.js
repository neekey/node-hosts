/**
 * 用户写入 hosts 文件
 * @type {*}
 */
var Utils = require( './utils' );
var FS = require( 'fs' );

try {
    var tmpGroupInfoPath = process.argv[ 2 ];
    var groups = JSON.parse( FS.readFileSync( tmpGroupInfoPath ) );
    Utils._write( groups );
    FS.unlinkSync( tmpGroupInfoPath );
}
catch( e ){
    throw new Error( e );
}
