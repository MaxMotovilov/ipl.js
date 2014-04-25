@@@ 
	if( arguments[0] ) {
		@ detectTarget:= arguments[0] @
	}
@@@

@ once @

	@@@ if( !target ) { @@@
		var	requested$Targets = @= requested$Targets @=;
		@= detectTarget @
		@= make$Target @
	@@@ } @@@

	var target =
		@@@ if( target ) { @@@ 
			@= target @ 
		@@@ } else { @@@
			detectTarget( navigator.userAgent||navigator.vendor||window.opera )
		@@@ } @@@
	;
@@

