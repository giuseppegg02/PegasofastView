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

(function() {
    'use strict';
  
    function monitorProgressBar() {
      // Seleziona l'elemento con ID progressbar
      var progressBar = document.querySelector('#progressbar');
  
      // se esiste progress bar
      if (progressBar) {
        console.log(progressBar.getAttribute('aria-valuenow'));
  
         // riproduce in automatico
          console.log("cerco di cliccare");
            // Seleziona tutti gli elementi con classe btn-default
            var buttons = document.querySelectorAll('.btn-default');

            // Itera sugli elementi
            for (var i = 0; i < buttons.length; i++) {
            // Verifica se l'elemento ha l'ID control-play
            if (buttons[i].id === 'control-play') {
                console.log(buttons[i].id);
        
                setInterval(function(){
                    buttons[i].click();
                    console.log("ho cliccato");},1000); // this will make it click again every 1000 miliseconds
                // L'elemento esiste
                
                var playButton = buttons[i];
                break;
            
}
          
        };
  
        // se esiste e vale 100
        if (progressBar.getAttribute('aria-valuenow')==100){
  
          console.log("vado avanti mi ha stancato");
          var firstEmptyCheck = document.querySelector('.icon-check-empty');
          firstEmptyCheck.click();
  
  
          // riproduce in automatico
          window.onload = function(){
            console.log("cerco di cliccare");
  
            var button = document.getElementById('fa-play-circle');
            console.log(button);
  
            setInterval(function(){
              button.click();
              console.log("ho cliccato");
  
            },1000); // this will make it click again every 1000 miliseconds
          };
        }
  
      } else {
  
         if (document.querySelector('.panel-body'))
        {var esatte = document.querySelector('.scriptBtn');
        esatte.click();
        }else {}
        var exitfromscreen = document.querySelectorAll('.fa-angle-double-left');
        exitfromscreen.click();
  
        console.log("Elemento progressbar non trovato");
  
        // esce dalle lezioni interne
  
  
  
        var mainscreen = document.querySelector('.espandi');
        espandi.click()
  
  
      }
    }
  
    // Attendi che la pagina sia completamente caricata
    window.onload = function() {
      // Avvia il monitoraggio dell'elemento progressbar
      setInterval(monitorProgressBar, 1000); // Controlla ogni secondo
      if (Notification.permission !== 'granted') {Notification.requestPermission();}
  
    };
  
    // Funzione per contare tutti i list-group-item nel documento
    function countListGroupItems() {
      // Seleziona tutti gli elementi con classe list-group-item
      var listGroupItems = document.querySelectorAll('.icon-check');
  
      // Stampa il numero totale di elementi list-group-item (già visualizzati)
      console.log('Numero totale di lezioni visualizzate: ' + listGroupItems.length);
    }
  
    // Avvia la funzione countListGroupItems
    countListGroupItems();
  
  })();