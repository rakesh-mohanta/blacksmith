var findit = require('findit'), 
    path   = require('path'),
    hl     = require('../../vendor/highlight/lib/highlight').Highlight,
    markdown = require('github-flavored-markdown'),
    mkdirp = require('mkdirp'),
    fs     = require('fs'),
    fs2 = require('../fs2'),
    docs   = require('../docs'),
    weld   = require('weld').weld,
    helpers = require('../helpers');

var content = exports;


content.weld = function(dom, pages) {

  //
  //  Remark: Create a short-cut reference to the jQuery object
  //
  var $ = docs.window.$;

  // Here, we build up the table of contents.
  var toc = helpers.buildToc(docs.src);

  Object.keys(pages).forEach( function (i) {

    // parse content if it exists
    if (pages[i].content) {
      var md;
      try {
        md = markdown.parse(pages[i].content.toString());
      } catch (err) {
        md = err.message;
      }
    }

    var metadata = pages[i].metadata;

    //join the author metadata
    if (metadata && metadata.author) {
      metadata.author = docs.content.authors[metadata.author]
                     || { name: metadata.author};
    }


    // Use article view if there's content
    if (md) {

      dom.innerHTML = docs.content.theme['./theme/article.html'].toString();

      var data = { 
        metadata: metadata, 
        content: md,
        toc: toc
      };

    // use directory view
    } else {
      dom.innerHTML = docs.content.theme['./theme/directory.html'];

      //set up the data
      var data = {
        pwd: helpers.unresolve(docs.src, i),
        ls: pages[i].ls,
        toc: toc,
        metadata: metadata
      };
    }

    weld(dom, data, {
      map: function(parent, element, key, val) {

        //
        // Create breadcrumb
        //
        if ($(element).hasClass('breadcrumb')) {
          var crumb = '';
          $('.breadcrumb', parent).each(function(i,v){
            crumb += ('/' + $(v).html());
          });
          crumb += ('/' + val);
          $(element).attr('href', crumb);
          $(element).html(val);
          return false
        }

        if ($(element).hasClass("ls")) {
          var title = val.split("/");
          title = title[title.length - 1].replace(/-/g, " ");
          var listing = $("<tr>").attr("class", "ls").append(
            $("<td>").append(
              $("<a>").attr("href", val.replace("pages/", "")).text(title)
            )
          );

          $("tr", $(element)).replaceWith(listing);
          return false;
        }

        //Handle dates
        if ($(element).hasClass("date")) {
          var date = val ? new Date(val).toISOString() : undefined;
          if (date) {
            $(element).attr("datetime", new Date(val).toISOString());
            $(element).text(val);
          }
          return false;
        }

        //Handle author metadata
        if ($(element).hasClass("github")) {
          if (val) {
            $(element).append(
              $("<a>")
                .attr("href", "https://github.com/"+val)
                .text("[github]")
            );
          }
          return false;
        }

        element.innerHTML = val;
        return false;
      }

    });

    // we need to clean up dom elements if metadata is missing
    if (typeof metadata.title === "undefined") {
      $("#metadata .title", dom).remove();
    };
    if (typeof metadata.date === "undefined") {
      $("#metadata .date", dom).parent().parent().parent().remove();
    };




    //if (!metadata.date) {
    //  console.log("no date!");
    //  $('.date').parent().remove();
    //}

    // Give the page a title
    $('title', dom).html('node docs - ' + (metadata && metadata.title) || "");

    // Add some meta tags
    $('meta[name=keywords]', dom).attr('content', 
      (metadata && metadata.tags || [])
        .concat(docs.config.get("tags") || []).join(',')
    );

    //
    // Remark: perform code highlighting, convert only inside <code/>
    // 
    // TODO: the current code highlighting is slow, very slow.
    //

    //
    // Remark: The hilighter tries to hilight "&gt;" as
    //
    //     `&amp;<span class="identifier">gt</span>;`
    //
    // There are probably a few other html identities that also get incorrectly
    // highlighted (such as &lt;).
    // The easiest way to fix this, besides using a different highlighter,
    // turns out to be running a greedy search/replace for the
    // bungled highlight.

    dom.innerHTML = hl(dom.innerHTML, false, true)
      .replace( new RegExp("&amp;<span class=\"identifier\">gt</span>;",
                "g"), "&gt;");

    pages[i].content = dom.innerHTML
      || docs.content.theme['./theme/article.html'].toString();

  });
  return dom;
};

content.generate = function(output, pages) {

  //
  // Generate articles and directory pages
  //
  Object.keys(pages).forEach(function(file){
    var newPath = file.replace(path.resolve(docs.src), path.resolve(docs.dst));

    //newPath =  path.dirname(newPath);
    newPath =  path.normalize(newPath + '/index.html');
    fs2.writeFile(newPath, pages[file].content, function(){});
  });

  return pages;
};



// Load all content with an fs2.readDirSync. It should be relatively
// indiscriminate.
content.load = function () {
  if (!docs.src) {
    docs.src = "../../pages";
  }
  
  // load all the contents
  // { "path": "content" }
  var pages = fs2.readDirSync(docs.src, true);

  // do some conversion here
  pages = helpers.dirToContent(docs.src, pages, true);

  return pages;
  
};