@@@ 
	if( arguments[0] ) {
		@ detectTarget:= arguments[0] @
	}
@@@

@ once @

	@@@ if( !target ) { @@@
		var	requested$Targets = @= requested$Targets.values @;
		@= make$Target @

		function detectTarget(str) {
			var m = @= new RegExp( "\\b(?:" + requested$Targets.contexts.join( "|" ) + ")\\b", "i" ) @.exec( str );
			if( m ) 
				for( var i=1; i<m.length; ++i )
					if( m[i] )
						return make$Target( requested$Targets[i-1], m[i] );
			return { name: "other" }
		}

	@@@ } @@@

	var target =
		@@@ if( target ) { @@@ 
			@= target @ 
		@@@ } else { @@@
			detectTarget( navigator.userAgent||navigator.vendor||window.opera )
		@@@ } @@@
	;
@@

