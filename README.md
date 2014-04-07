ipl.js
======

Initial page loader toolkit for JS Web applications, based on Node.js backend

Synopsis
--------

A two-stage template engine intended to simplify the initialization process of
complex client-centric Web applications. The page content can be customized using
information available to the server as well as the information available only
to the script executing on the client side.

The input of the engine is a template describing either the bootstrap script that
builds page content or the HTML file embedding such a script. The output of the engine
is either a complete HTML page, a page fragment, or content of the bootstrap script
to be loaded via HTML `<script>` element. 

API
---

	var ipl = require( 'ipl' )( configuration ),
		fs = require( 'fs' );
	
	ipl( fs.createReadStream( input_file_name ), environment, is_script_content, args )
		.error( onError )
		.pipe( fs.createWriteStream( output_file_name ) );

### configuration

Dictionary with any of the following fields:

* `include`: an array containing paths that will be searched for included fragments or functions that accept a string and return an open stream or `null`.
* `env`: global environment that can be extended at every invokation via the `environment` argument.
* `encoding`: encoding of both the input files/streams and the output stream, defaults to `"utf8"`.
* `dontRun`: output the server-side script code instead of executing it; use for debugging.

### environment

A dictionary of names that will be visible to resulting server-side scripts as global variables. All kinds of Javascript values, objects or functions could 
be passed via environment, not just strings and numbers.

### is_script_content

Pass `false` if your input template represents HTML to be sent to the client. Pass `true` if the template represents the bootstrap script itself.

### args

An array of argument values to be passed to the top-level server-side script. 

Template syntax
---------------

### Content types

There are three types of content processed by the template engine: server-side or "build" scripts, client-side or "IPL" (initial page loader) scripts
and HTML. The HTML content could be processed on the server as well as on the client, depending on where it was included from: HTML content encountered
at top level will be fully processed on the server whereas the same content encountered inside an IPL script will be embedded into the script and
processed at the time page is loaded into the browser. Build scripts can be used to conditionally generate either IPL script content or HTML content
on the server; embedding IPL script blocks into HTML content achieves the same effect on the client side.

### Content blocks

	@@@ Build-script-code @@@

Injects _build-script-code_ directly into the resulting server side script; everything between the `@@@` brackets is build script content. IPL scripts 
or HTML content cannot be embedded directly into build scripts.

	@@ IPL-script-code @@

Injects _IPL-script-code_ into HTML content generated on the client side; everything betwee the `@@` brackets is IPL script content. This form of IPL 
script embedding is possible only in HTML fragments directly or indirectly included from the `@ipl@` block.

	@@ HTML-content @@

Injects dynamically generated HTML content into IPL script code. This form of HTML content embedding is possible only at the top level of IPL script 
fragments, otherwise the leading `@@` bracket will be treated as a terminating `@@` bracket of a previously open content block.

	@ipl@ IPL-script-code @@

Used to denote the location of the IPL script in the server-generated HTML content.

	@html@ HTML-content @@

Used to embed HTML content into nested blocks inside IPL scripts

	@once@ build-script-code @@

When encountered within build script content, ensures that _build-script-code_ will only appear in the resulting server-side script once (generally before
any other generated code). Use this to inject commonly used server-side functions.

	@once@ IPL-script-code @@

When encountered within IPL script content, ensures that identical expansions of _IPL-script-code_ will only appear in the resulting bootstrap script once.
Use this to inject commonly used client-side functions. Note that build-time substitutions within the _IPL-script-code_ may produce different expansions of
the Javascript content; each such expansion will appear in the bootstrap script separately.

### Substitutions

	HTML-content @== Build-expression @ HTML-content

_Build-expression_ is evaluated at the server side and injected into the resulting HTML content as a string.

	HTML-content @= IPL-expression @ HTML-content

_IPL-expression_ is evaluated at the client side and injected into the resulting HTML content as a string.

	IPL-script-code @= Build-expression @ IPL-script-code

_Build-expression_ is evaluated at the server side and injected into the resulting Javascript code as a stringified value: a boolean, numeric, string, 
object, array or regular expression literal. Use this form of substitution to pass Javascript values directly from build scripts to IPL scripts without
worrying about proper formatting.

	IPL-script-code @== Build-expression @ IPL-script-code

_Build-expression_ is evaluated at the server side and injected into the resulting Javascript code as a string. Use this form of substitution to form
composite names or formatted strings within IPL script code.

### Fragment inclusion

	@name@

When encountered within HTML content, finds `name.html` on the include path and embeds its content. When encountered within IPL script content, finds
`name.js` on the include path and embeds its content.

	@name:some-text:some-more-text@

Use to pass arguments into included fragments; the passed values are accessible as strings via the Javascript `arguments` array from any build script 
content or substitutions.

	@name:=some-expression:=some-other-expression@

Instead of string arguments, passed arbitrary build-time expressions. Note however that fragment expansions are processed *before* the build script
content executes therefore variable values assigned by the build scripts will not be visible in these argument expressions. The environment variables
are, of course, visible -- and so is the `arguments` array from the embedding fragment.

	@html:name@

Use to directly embed an HTML fragment into IPL script content. Arguments for the fragment can be passed after the `name`.

	@ipl:name@

Use to directly embed an IPL script fragment into HTML content, or to embed the top-level IPL block from a separate file. Arguments for the fragment 
can be passed after the `name`.

	@html:=expression@
	@ipl:=expression@

Dynamically compute the name of the fragment to load (can also pass arguments into it).
