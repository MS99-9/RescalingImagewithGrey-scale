function setLink(x) {
  if (x.files && x.files[0]) {
    var file = x.files[0];
    var reader = new FileReader();

    reader.onload = function(event1) {
      localStorage.setItem("image", event1.target.result);
      $(".uploadedimage").attr("src", event1.target.result);

      $(".content").show();

      $(".image-title").html(file.name);
    };
    reader.readAsDataURL(file);
  }
}
function loadImage() {
  var image = localStorage.getItem("image");

  $(".image").attr("src", image);
}

function getScale() {
  var xaxis = prompt("Enter x-factor", "");
  var yaxis = prompt("Enter y-factor", "");
  if (xaxis != null && yaxis != null) {
    localStorage.setItem("xaxis", xaxis);
    localStorage.setItem("yaxis", yaxis);
  }
}
function NearestNeighbour(){
  var xaxis = Number(localStorage.getItem("xaxis"));
  var yaxis = Number(localStorage.getItem("yaxis"));
  // canvas1 will be handled by the gpu
  const canvas1 = document.createElement("canvas");
  canvas1.className = 'c1';
  const context1 = canvas1.getContext("webgl2"); //will create a WebGL2RenderingContext object representing a three-dimensional rendering context.
  const gpu = new GPU({
    canvas: canvas1,
    webGl: context1
  });
  document.body.appendChild(canvas1);

  // canvas2 will render the image
  const canvas2 = document.createElement("canvas");
  canvas2.className = 'c2';
  const context2 = canvas2.getContext("2d");
  // document.body.appendChild(canvas2);
  canvas2.style.transform = 'scale('+ xaxis + ',' + yaxis +')';

  // load the image
  const image = new Image();
  image.crossOrigin = "Anonymous";
  // image.crossOrigin allows images defined by the <img> element that are loaded from foreign origins to be used
  // in a <canvas> as if they had been loaded from the current origin.
  image.src = localStorage.getItem("image")

  image.onload = function() {
    // render image to canvas2
    canvas2.width = image.width;
    canvas2.height = image.height;
    context2.drawImage(image, 0, 0);
    //scale image
    const imgData = context2.getImageData(0,0,image.width,image.height);
    for(var j = 0; j < imgData.height; j++){ // y for rows
      for(var i= 0; i < imgData.width; i++){ // x for columns
          var x = (j* 4) * imgData.width + i * 4; // no. of current pixel in the new image
          var avg = (imgData.data[x] + imgData.data[x + 1] + imgData.data[x + 2]) / 3;
          imgData.data[x] = avg;
          imgData.data[x + 1] = avg;
          imgData.data[x + 2] = avg;
      }
  }
    const gpuRender = gpu
      .createKernel(function(sprite) {
        var x = floor(this.thread.x/this.constants.s1) * 4;
        var y = floor(this.constants.h - this.thread.y/this.constants.s2) * 4 * this.constants.w;
        var index = x + y;
        var r = sprite[ index ]/255;
        var g = sprite[index+1]/255;
        var b = sprite[index+2]/255;
        var a = sprite[index+3]/255;
        this.color(r, g, b, a);
      },{
        constants: {
          w: image.width,
          h: image.height,
          s1: xaxis,
          s2: yaxis
        }
      })
      .setOutput([image.width*xaxis, image.height*yaxis])
      .setGraphical(true);

    gpuRender(imgData.data);
  };
}
function bilinear(){
  function ivect(ix, iy, w) {
    // byte array, r,g,b,a
    return (ix + w * iy) * 4;
  }

  function bilinear(srcImg, destImg, yaxis, xaxis) {
    function inner(f00, f10, f01, f11, x, y) {
      var un_x = 1.0 - x;
      var un_y = 1.0 - y;
      return f00 * un_x * un_y + f10 * x * un_y + f01 * un_x * y + f11 * x * y;
    }
    var i, j;
    var iyv, iy0, iy1, ixv, ix0, ix1;
    var idxD, idxS00, idxS10, idxS01, idxS11;
    var dx, dy;
    var r, g, b, a;
    for (i = 0; i < destImg.height; ++i) {
      iyv = i / xaxis;
      iy0 = Math.floor(iyv);
      iy1 =
        Math.ceil(iyv) > srcImg.height - 1 ? srcImg.height - 1 : Math.ceil(iyv);
      for (j = 0; j < destImg.width; ++j) {
        ixv = j / yaxis;
        ix0 = Math.floor(ixv);
        ix1 =
          Math.ceil(ixv) > srcImg.width - 1 ? srcImg.width - 1 : Math.ceil(ixv);
        idxD = ivect(j, i, destImg.width);
        idxS00 = ivect(ix0, iy0, srcImg.width);
        idxS10 = ivect(ix1, iy0, srcImg.width);
        idxS01 = ivect(ix0, iy1, srcImg.width);
        idxS11 = ivect(ix1, iy1, srcImg.width);
        dx = ixv - ix0;
        dy = iyv - iy0;
        r = inner(
          srcImg.data[idxS00],
          srcImg.data[idxS10],
          srcImg.data[idxS01],
          srcImg.data[idxS11],
          dx,
          dy
        );
        destImg.data[idxD] = r;

        g = inner(
          srcImg.data[idxS00 + 1],
          srcImg.data[idxS10 + 1],
          srcImg.data[idxS01 + 1],
          srcImg.data[idxS11 + 1],
          dx,
          dy
        );
        destImg.data[idxD + 1] = g;

        b = inner(
          srcImg.data[idxS00 + 2],
          srcImg.data[idxS10 + 2],
          srcImg.data[idxS01 + 2],
          srcImg.data[idxS11 + 2],
          dx,
          dy
        );
        destImg.data[idxD + 2] = b;

        a = inner(
          srcImg.data[idxS00 + 3],
          srcImg.data[idxS10 + 3],
          srcImg.data[idxS01 + 3],
          srcImg.data[idxS11 + 3],
          dx,
          dy
        );
        destImg.data[idxD + 3] = a;
      }
    }
    for (var i = 0; i < destImg.height; i++) {
      for (var j = 0; j < destImg.width; j++) {
        var pxl = i * 4 * destImg.width + j * 4;
        var avg =
          (destImg.data[pxl] + destImg.data[pxl + 1] + destImg.data[pxl + 2]) / 3;
        destImg.data[pxl] = avg;
        destImg.data[pxl + 1] = avg;
        destImg.data[pxl + 2] = avg;
      }
    }
  }

  try {
    var loadCan = document.getElementById("load-canvas");
    var dispCan = document.getElementById("disp-canvas");

    var loadCtx = loadCan.getContext("2d");
    var dispCtx = dispCan.getContext("2d");

    var xaxis = Number(localStorage.getItem("xaxis"));
    var yaxis = Number(localStorage.getItem("yaxis"));

    var image_var = new Image();
    image_var.onload = function() {
      loadCan.setAttribute("width", image_var.width);
      loadCan.setAttribute("height", image_var.height);
      loadCan.style.position = "fixed";
      loadCan.width = image_var.width;
      loadCan.height = image_var.height;
      loadCtx.drawImage(image_var, 0, 0, image_var.width, image_var.height);

      var srcImg = loadCtx.getImageData(0, 0, image_var.width, image_var.height);

      var newWidth = Math.ceil(image_var.width * xaxis);
      var newHeight = Math.ceil(image_var.height * yaxis);
      dispCan.width = newWidth;
      dispCan.height = newHeight;
      dispCan.setAttribute("width", newWidth);
      dispCan.setAttribute("height", newHeight);
      var destImg = dispCtx.createImageData(newWidth, newHeight);
      bilinear(srcImg, destImg, xaxis, yaxis);
      dispCtx.putImageData(destImg, 0, 0);
    };
    image_var.crossOrigin = "Anonymous";

    image_var.src = localStorage.getItem("image");
  } catch (error) {
    alert(error);
  }

}
