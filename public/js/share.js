"use strict";


function SecureShare()
{
  var urlHashFy = function(text) {
    return text.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/g, '|');
  };
  var base64KeyDecode = function(key) {
    var k = key.replace(/\-/g, '+').replace(/_/g, '/') + "=";
    return CryptoJS.enc.Base64.parse(k);
  }
  var baseLink = function() {
    var link = window.location.protocol + "//" + window.location.hostname;
    if (window.location.port != "") {
      link += ":" + window.location.port;
    }
    return link;
  }
  var formLink = function(id, hash) {
    return baseLink() + "/s/"+id+"#" + hash
  }

  var encrypt = function(text, passphrase, attach) {
    var secret = {
      att: attach,
    };
    var encText;
    var encFile;
    var hash = ""
    if (passphrase == "") {
      var iv  = CryptoJS.lib.WordArray.random(32);
      var key = CryptoJS.lib.WordArray.random(32);
      hash = urlHashFy(iv.toString(CryptoJS.enc.Base64));
      hash += urlHashFy(key.toString(CryptoJS.enc.Base64));
      hash = hash.substring(0, hash.length-1);
      encText = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
    } else {
      encText = CryptoJS.AES.encrypt(text, passphrase, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      hash = urlHashFy(encText.salt.toString(CryptoJS.enc.Base64));
      hash = hash.substring(0, hash.length-1);
      secret.passHash = CryptoJS.HmacSHA256(passphrase, hash).toString(CryptoJS.enc.Base64);
    }
    secret.data = encText.ciphertext.toString(CryptoJS.enc.Base64);
    $.ajax({
      url: baseLink() + "/p",
      type: "post",
      data: secret,
      dataType: "json"
    }).done(function(data) {
      $("#share_url").val(formLink(data.id, hash));
      $("#link_div").show();
      $("#secret_div").hide();
    });
  }
  $("#re_share_button").click(function() {
    $("#encrypt_button").click();
  });
  $("#new_button").click(function() {
    $("#link_div").hide();
    $("#secret_div").show();
    $("#passphrase").val("");
    $("#source").val("");
    $("#source_file").val("");
  });
  $("#encrypt_button").click(function() {
    var text = $("#source").val();
    var passphrase = $("#passphrase").val();
    var input = document.getElementById('source_file');
    if (input && input.files && input.files[0]) {
      var file = input.files[0];
      if (file.size > 1024 * 128) { // 128 kb max file size
        alert("Maximum file size should not exceed 128kb");
        return;
      }
      var fr = new FileReader();
      fr.onload = function() {
        var f = {
          t: text,
          n: file.name,
          d: fr.result
        }
        encrypt(JSON.stringify(f), passphrase, true);
      };
      fr.readAsDataURL(file);
      return;
    }
    if (!text) {
      alert("Text or file should be provided");
      return;
    }
    encrypt(text, passphrase);
  });

  var keyParts = [];
  $("#show_button").click(function() {
    $("#error").hide();
    var secret = {};
    if (keyParts.length == 1) {
      var passphrase = $("#passphrase").val();
      secret.passHash = CryptoJS.HmacSHA256(passphrase, keyParts[0]).toString(CryptoJS.enc.Base64);
    }
    var id = window.location.pathname.split("/")
    secret.id = id[id.length-1]
    $.ajax({
      url: baseLink() + "/g",
      type: "post",
      data: secret,
      dataType: "json"
    }).done(function(data) {
      var dec = "";
      if (keyParts.length == 1) {
        dec = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(CryptoJS.lib.CipherParams.create({
          ciphertext: CryptoJS.enc.Base64.parse(data.data), salt: base64KeyDecode(keyParts[0])
          }), passphrase, {
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
          }));
      } else {
        dec = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(data.data, base64KeyDecode(keyParts[1]), {
          iv: base64KeyDecode(keyParts[0]),
        }));
      }
      if (data.attach) {
        var d = JSON.parse(dec);
        $("#secret_file").html("Download: " + d.n);
        $("#secret_file").attr("href", d.d);
        $("#secret_file").attr("download", d.n);
        $("#source").val(d.t);
      } else {
        $("#source").val(dec);
      }
      $("#secret_div").show();
    }).fail(function(data){
      $("#error").html(data.responseJSON.error.code + ": " + data.responseJSON.error.message);
      $("#error").show();
    });
  })
  if (window.location.pathname.match(/^\/s\//) && window.location.hash.length > 0) {
    keyParts = window.location.hash.substring(1).split("|");
    if (keyParts.length == 1) {
      $("#passphrase_div").show()
    } else if (keyParts.length != 2) {
      alert("Got wrong keys: " + keyParts);
      return;
    }
    $("#show_button").show();
  }
};

$(function() {
  console.log( "ready!" );
  window.SecureShare = new SecureShare();
});