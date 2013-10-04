var FS = require( 'fs' );
var PATH = require( 'path' );
var CHILD = require( 'child_process' );
var Chalk = require( 'chalk' );

var HOSTS_DIR = '/etc/hosts';
var HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var HOSTS_DB_DIR = PATH.resolve( HOME, '.node-hosts' );
var HOSTS_DB_PATH = PATH.resolve( HOSTS_DB_DIR, 'hosts.json' );

/**
 * 检查目录是否存在，不存在就创建一个
 */
if( !FS.existsSync( HOSTS_DB_DIR ) ){
    FS.mkdirSync( HOSTS_DB_DIR );
}

module.exports = {

    /**
     * 区域开始标记
     */
    __BEGIN: '##NODE-HOSTS-BEGIN',
    /**
     * 区域结束标记
     */
    __END: '##NODE-HOSTS-END',
    /**
     * 群组开始标记
     */
    __TAG_BEGIN: '## NODE-HOSTS GROUP BEGIN:',
    /**
     * 群组结束标记
     */
    __TAG_END: '## NODE-HOSTS GROUP END',

    /**
     * Read all the hosts info.
     */
    read: function(){
        if( FS.existsSync( HOSTS_DB_PATH ) ){
            return require( HOSTS_DB_PATH );
        }
        else {
            FS.writeFileSync( HOSTS_DB_PATH, JSON.stringify( { groups: [] } ) );
            return { groups: [] };
        }
    },

    /**
     * 写入 hosts 文件，执行 sudo，将会向用户请求权限
     * todo 考虑兼容windows
     * @param groups
     * @param next
     */
    write: function( groups, next ){

        console.log( '\n' + Chalk.yellow( '保存hosts...' ) + Chalk.grey( '(可能需要您输入管理员密码)' ) );
        var randomName = PATH.resolve( HOSTS_DB_DIR, Math.random().toString( 16 ) );
        FS.writeFileSync( randomName, JSON.stringify( groups ) );
        var child = CHILD.exec( 'sudo node ' + PATH.resolve( __dirname, 'write.js ' + randomName ), function( err ){
            if( err ){
                console.log( Chalk.red( '保存hosts文件出错：'), err );
                process.exit(1);
            }
            else {
                next( err );
            }
        });

        // 连接子进程的输出流
        child.stdout.pipe( process.stdout );
        child.stderr.pipe( process.stderr );
    },

    _write: function( groups, path ){

        path = path || HOSTS_DIR;
        this.raw = FS.readFileSync( path ).toString();
        var newRaw = '';
        var stat = 'out';
        var self = this;
        var ever = false;

        this.raw.split( /\n/g).forEach(function( line ){

            if( (new RegExp( self.__BEGIN )).test( line ) ){
                stat = 'in';
                ever = true;
                newRaw += line + '\n';
                newRaw += groupString();
            }
            else if( (new RegExp( self.__END )).test( line ) ){
                stat = 'out';
                newRaw += line + '\n';
            }
            else {
                if( stat != 'in' ){
                    newRaw += line + '\n';
                }
            }
        });

        if( !ever ){
            newRaw += '\n' + this.__BEGIN + '\n' + groupString() + this.__END;
        }

        // 写入 /etc/hosts
        FS.writeFileSync( path, newRaw );
        // 保存到数据文件中
        var hostInfo = this.read();
        hostInfo.groups = groups;
        FS.writeFileSync( HOSTS_DB_PATH, JSON.stringify( hostInfo ) );

        return newRaw;

        function groupString(){
            var str = '';

            if( groups ){
                groups.forEach(function( group ){
                    str += self.__TAG_BEGIN + group.name + '\n';
                    group.hosts.forEach(function( host ){
                        str += ( group.active ? '' : '## ' ) + host.ip + ' ' + host.domain + '\n';
                    });
                    str += self.__TAG_END + '\n\n';
                });
            }

            return str;
        }
    },

    /**
     * 根据组名获取组信息
     * @param groups
     * @param name
     * @returns {null}
     */
    getGroupByName: function( groups, name ){
        var target = null;

        groups && groups.forEach(function( group ){

            if( group.name == name ){
                target = group;
            }
        });

        return target;
    }
};