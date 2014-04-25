@ global: request @

@once@
	var query = 
		@@@ if( request && request.query ) { @@@
			@= request.query @
		@@@ } else { @@@
			(function( s ) {
				var r = {};
				s.split('&').forEach( function( e ) {
					e = e.split('=');
					r[e[0]] = e[1] || "";
				} );
				return r;
			})( window.location.search.substr( 1 ) )
		@@@ } @@@
	;
@@
