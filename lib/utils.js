var FS = require( 'fs' );
var PATH = require( 'path' );
var CHILD = require( 'child_process' );
var Chalk = require( 'chalk' );
var _ = require( 'underscore' );
var Parse = require( './parse').Parse;

Parse.initialize("UwKSGYtmQs4xt4vDtZheVmz0XkatA34eys2yCTQQ", "Zu0g5y5QsV0KCMsnFwtNPrN9CWvMuClS3cyxAY5w");

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

var Utils = module.exports = {

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
            FS.writeFileSync( HOSTS_DB_PATH, JSON.stringify( { groups: {} } ) );
            return { groups: {} };
        }
    },

    /**
     * Remove all redundant data.
     * @param groups
     * @param [groups2]
     */
    dataHandle: function( groups, groups2 ){

        if( groups2 ){
            _.each( groups2, function( group, name ){
                if( !( name in groups ) ){
                    groups[ name ] = group;
                }
                else {
                    groups[ name ].hosts = groups[ name ].hosts.concat( group.hosts );
                }
            });
        }

        _.each( groups, function( group ){
            group.hosts.forEach(function( host, index ){

                if( host ){
                    group.hosts.forEach(function( h, i ){

                        if( h && i != index ){
                            if( host.ip == h.ip && host.domain == h.domain ){
                                group.hosts[ index ] = null;
                            }
                        }
                    });
                }
            });

            group.hosts = _.compact( group.hosts );
        });

        return groups;
    },

    /**
     * 写入 hosts 文件，执行 sudo，将会向用户请求权限
     * todo 考虑兼容windows
     * @param groups
     * @param next
     */
    write: function( groups, next ){

        groups = this.dataHandle( groups );

        console.log( '\n' + Chalk.yellow( '保存hosts...' ) + Chalk.grey( '(可能需要您输入管理员密码)' ) );
        var randomName = PATH.resolve( HOSTS_DB_DIR, Math.random().toString( 16 ) );
        FS.writeFileSync( randomName, JSON.stringify( groups ) );
        var child = CHILD.exec( 'sudo node ' + PATH.resolve( __dirname, 'write.js ' + randomName ), function( err ){
            if( err ){
                console.log( Chalk.red( '保存hosts文件出错：'), err );
                process.exit(1);
            }
            else {
                next && next( err );
            }
        });

        // 连接子进程的输出流
        child.stdout.pipe( process.stdout );
        child.stderr.pipe( process.stderr );

        // If already logged in, save to server.
        if( this.current() ){
            this.save( groups );
        }
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

        this.saveData( hostInfo );

        return newRaw;

        function groupString(){
            var str = '';

            if( groups ){
                _.each( groups, function( group, name ){
                    str += self.__TAG_BEGIN + name + '\n';
                    group.hosts.forEach(function( host ){
                        str += ( group.active ? '' : '## ' ) + host.ip + ' ' + host.domain + '\n';
                    });
                    str += self.__TAG_END + '\n\n';
                });
            }

            return str;
        }
    },

    saveData: function( data ){
        FS.writeFileSync( HOSTS_DB_PATH, JSON.stringify( data ) );
    },

    /* -------- local data action -------- */
    addGroup: function( groupName, next ){
        var Groups = this.read().groups;
        if( !( groupName in Groups ) ){
            Groups[ groupName ] = { hosts: [] };
            this.write( Groups, next );
        }
        else {
            next && next();
        }
    },

    addRule: function( groupName, ip, domain, next ){

        var Groups = this.read().groups;
        if( groupName in Groups ){
            Groups[ groupName ].hosts.push( {
                ip: ip,
                domain: domain
            });

            this.write( Groups, next );
        }
        else {
            next && next();
        }
    },

    toggleGroup: function( groupName, next ){

        var Groups = this.read().groups;
        if( groupName in Groups ){
            Groups[ groupName ].active = !Groups[ groupName ].active;
            this.write( Groups, next );
        }
        else {
            next && next();
        }
    },

    removeGroup: function( groupName, next ){

        var Groups = this.read().groups;
        if( groupName in Groups ){
            delete Groups[ groupName ];
            this.write( Groups, next );
        }
        else {
            next && next();
        }
    },

    removeRule: function( groupName, ip, domain, next ){

        var Groups = this.read().groups;
        if( groupName in Groups ){
            var hosts = Groups[ groupName ].hosts;

            hosts.forEach(function( host, index ){

                if( host.ip == ip && host.domain == domain ){
                    hosts[ index ] = null;
                }
            });

            Groups[ groupName ].hosts = _.compact( hosts );

            this.write( Groups, next );
        }
        else {
            next && next();
        }
    },

    /* -------- User Action ------ */

    signUp: function( email, password, next ){

        var self = this;
        var user = new Parse.User();
        var Groups = this.read().groups;
        user.set("username", email );
        user.set("password", password );
        user.set("email", email );

        user.signUp(null, {
            success: function() {
                // Save local data to server.
                self.save( Groups, function( error ){
                    if( error ){
                        next && next( error );
                    }
                    else {
                        next && next( null );
                    }
                });
            },
            error: function(user, error) {
                next && next( error );
            }
        });
    },

    /**
     * Login
     * @param email
     * @param password
     * @param next
     */
    login: function( email, password, next ){
        var self = this;
        var localGroups = this.read().groups;

        Parse.User.logIn( email, password, {
            success: function(user) {

                // Fetch remote data
                self.fetch( function( error, groups ){
                    if( error ){
                        next && next( error );
                    }
                    else {
                        // Save both to local and server.
                        self.write( self.dataHandle( localGroups, groups ), next );
                    }
                });
            },
            error: function(user, error) {
                next && next( error );
            }
        });
    },

    logout: function(){
        Parse.User.logOut();
    },

    save: function( groups, next ){
        var user = this.current();
        user.set( 'hostGroups', groups );
        user.save(null, {
            success: function( user ) {
                next && next();
            },
            error: function(gameScore, error) {
                next && next( error );
            }
        });
    },

    fetch: function( next ){
        var user = this.current();
        user.fetch({
            success: function( user) {
                next && next( null, user.get( 'hostGroups' ) );
            },
            error: function( user, error) {
                next && next( error );
            }
        });
    },

    current: function(){
        return Parse.User.current();
    }
};

