!function(){

  // define wrapper elements with containers
  var wrappers = [
    {
      selector: '.post p img',
      wrapContainer: '<div class="post-image"></div>'
    },
    {
      selector: 'table.highlighttable, div>div.highlight',
      wrapContainer: '<figure class="code"></figure>'
    }
  ];

  /**
   * Wrap defined elements in proper containers
   * @return {[type]} [description]
   */
  function wrapElements() {
    for (var i = 0, len = wrappers.length; i < len; i++) {
      $(wrappers[i].selector).wrap(wrappers[i].wrapContainer);
    }
  }
  wrapElements();




  //.parallax(xPosition, speedFactor, outerHeight) options:
  //xPosition - Horizontal position of the element
  //inertia - speed to move relative to vertical scroll. Example: 0.1 is one tenth the speed of scrolling, 2 is twice the speed of scrolling
  //outerHeight (true/false) - Whether or not jQuery should use it's outerHeight option to determine when a section is in the viewport

  // $('#intro').parallax("50%", 0.1);
  // $('#second').parallax("50%", 0.1);
  // $('.bg').parallax("50%", 0.4);
  // $('#third').parallax("50%", 0.3);




  var $lolipopBorder = $('.lolipop-border');
  var $lolipopFont = $('.lolipop-font');
  var orientations = [0, 60, 120, 180, 240, 300];
  var point = 0;

  /**
   * [lolipop description]
   * @return {[type]} [description]
   */
  function lolipop() {
    var hue = orientations[point];
    point++;
    if (point > orientations.length - 1) {
      point = 0;
    }
    var hsl = 'hsl(' + hue + ' ,100%, 50%)';

    $lolipopBorder.css('border-color', hsl);
    $lolipopFont.css('color', hsl);
    setTimeout(lolipop, 14000);
  }


}();
