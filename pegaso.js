// ==UserScript==
// @name   UniPegaso - Fast skip video
// @include   /.*pegaso\.multiversity\.click.*/
// @grant  none
// @author  GiuseppeR
// @description FA LE MAGIE
// @version 1
// @run-at  document-end
// @license MIT
// ==/UserScript==

(
  function() {
    'use strict';
  
    function monitorProgressBar() {
      // Seleziona l'elemento con ID progressbar
      var progressBar = document.querySelector('#progressbar');
  
      // se esiste progress bar
      if (progressBar) {
        console.log(progressBar.getAttribute('aria-valuenow'));
        console.log("Elemento progressbar trovato");

      
          
            // Seleziona tutti gli elementi con classe btn-default
            var buttons = document.querySelectorAll('.btn-default');

            // Itera sugli elementi
            for (var i = 0; i < buttons.length; i++) {// Verifica se l'elemento ha l'ID control-play
            if (buttons[i].id === 'control-play') {buttons[i].click();break;}};
  
        // se esiste e vale 100
        if (progressBar.getAttribute('aria-valuenow')==100){
  
          console.log("prossima lezione");
          var firstEmptyCheck = document.querySelector('.icon-check-empty');
          firstEmptyCheck.click();
        }
  

      } else {
          console.log("Elemento progressbar non trovato");

         if (document.querySelector('.panel-body'))
        {var esatte = document.querySelector('.scriptBtn');
        esatte.click();
        }else {}
        var exitfromscreen = document.querySelectorAll('.fa-angle-double-left');
        exitfromscreen.click();
  
  
        // esce dalle lezioni interne
  
  
  
        var mainscreen = document.querySelector('.espandi');
        espandi.click()
  
  
      }
    }


    function countListGroupItems() {
      
      // Seleziona tutti gli elementi con classe list-group-item
      var listGroupItems = document.querySelectorAll('.icon-check');
  
      // Stampa il numero totale di elementi list-group-item (già visualizzati)
      console.log('Numero totale di lezioni visualizzate: ' + listGroupItems.length);
    }


  
    // Attendi che la pagina sia completamente caricata
    window.onload = function() {
      // Avvia il monitoraggio dell'elemento progressbar
      setInterval(monitorProgressBar, 1000); // Controlla ogni secondo
      countListGroupItems();


      if (Notification.permission !== 'granted') {Notification.requestPermission();}
  
    };
  
   
  
  
  
  })();