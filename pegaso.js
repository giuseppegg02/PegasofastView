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

      
          
            // Seleziona tutti gli elementi con classe btn-default
            var buttons = document.querySelectorAll('.btn-default');
            var albero =0;
            // Itera sugli elementi
            for (var i = 0; i < buttons.length; i++) {
              // Verifica se l'elemento ha l'ID control-play
              if (buttons[i].id === 'control-play') {
                buttons[i].click();
                //setTimeout(2000);

                


                
                if (progressBar.getAttribute('aria-valuenow')==100){
                  console.log("if 100")
  
                  console.log("prossima lezione");
                  var firstEmptyCheck = document.querySelector('.icon-check-empty');
                  firstEmptyCheck.click();
                }else{}
               //console.log("attesa 2 secondi")
                setTimeout(2000);

                }
            };
  
        // se esiste e vale 100

  

      } else {
        console.log("non ho trovato la progress");


        var firstEmptyCheck = document.querySelector('.icon-check-empty');
        window.location.href = "https://lms-courses.pegaso.multiversity.click/main/lp-video_student_view/lp-video_controller.php";


        if (firstEmptyCheck){
          console.log("non sono entrato nell'if");

        firstEmptyCheck.click();
        
        }else{
          console.log("provo ad uscire");
          document.addEventListener("DOMContentLoaded", goToLink);

          var mappa = document.querySelectorAll('.fa-angle-double-left');
          mappa.click();
      }

  
        
  
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