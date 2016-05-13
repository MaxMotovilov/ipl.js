@ global: promise @
@ promise: value := promise.returnLater( "Result" ) @
	
@@@ if( arguments[0] ) { @@@
	@html@
		@== value @
	@@
@@@ } @@@

