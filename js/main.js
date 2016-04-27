/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null;
var rafID = null;
var analyserContext = null;
var canvasWidth, canvasHeight;
var recIndex = 0;
var dweetNamespace = "prova-browser-pub-" + (new Date().getTime());
var avgMagnitude = 0;  // dav can be considered like the volume
var recording = true;


function dweetReadUrl(dweetNameSpace){
    return "https://dweet.io/get/latest/dweet/for/" + dweetNamespace;    
}

/* TODO:

- offer mono option
- "Monitor input" switch
*/

function saveAudio() {
    audioRecorder.exportWAV( doneEncoding );
    // could get mono instead by saying
    // audioRecorder.exportMonoWAV( doneEncoding );
}


function doneEncoding( blob ) {
    Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
    recIndex++;
}

function toggleRecording( e ) {
    if (e.classList.contains("recording")) {        
        console.log("Stopping recording");
        recording = false;
        if (audioRecorder){
            audioRecorder.stop();
            audioRecorder.clear();
            e.classList.remove("recording");
            //audioRecorder.getBuffers( gotBuffers );            
        }
        
        
    } else {

        console.log("Starting recording");
        if (!audioRecorder) {
            console.error("Could not find audioRecorder!!");
            return;
        }
            
        e.classList.add("recording");
        audioRecorder.clear();
        audioRecorder.record();
        recording = true;
    }
}

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

function cancelAnalyserUpdates() {
    window.cancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    if (recording){
        if (!analyserContext) {
            var canvas = document.getElementById("analyser");
            canvasWidth = canvas.width;
            canvasHeight = canvas.height;
            analyserContext = canvas.getContext('2d');
        }

        // analyzer draw code here
        {
            var SPACING = 3;
            var BAR_WIDTH = 1;
            var numBars = Math.round(canvasWidth / SPACING);
            var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

            analyserNode.getByteFrequencyData(freqByteData); 

            analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            analyserContext.fillStyle = '#F6D565';
            analyserContext.lineCap = 'round';
            var multiplier = analyserNode.frequencyBinCount / numBars;

            var totalMagnitude = 0;
            

            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor( i * multiplier );
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (var j = 0; j< multiplier; j++)
                    magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier;
                totalMagnitude += magnitude;
                var magnitude2 = freqByteData[i * multiplier];
                analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
                analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
            }
            
            avgMagnitude = totalMagnitude / numBars;                
        }                
    }
    rafID = window.requestAnimationFrame( updateAnalysers );
    
}

function toggleMono() {
    if (audioInput != realAudioInput) {
        audioInput.disconnect();
        realAudioInput.disconnect();
        audioInput = realAudioInput;
    } else {
        realAudioInput.disconnect();
        audioInput = convertToMono( realAudioInput );
    }

    audioInput.connect(inputPoint);
}

function gotStream(stream) {
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

//    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect( analyserNode );

    audioRecorder = new Recorder( inputPoint );

    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect( zeroGain );
    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function updateDweetNamespace(){
    var dweetNameInput = $('#dweet-name-input');
    dweetNamespace =  dweetNameInput.val();        
    
    var readLink = $('#dweet-read-url');                            
    readLink.text(dweetReadUrl(dweetNamespace))
            .attr('href', dweetReadUrl(dweetNamespace));    
}

function init() {            
            
        var dweetNameInput = $('#dweet-name-input');                            
        
        dweetNameInput.val(dweetNamespace)
                      .change(function(){
                            updateDweetNamespace(); 
                        });                     
    
        updateDweetNamespace();
    
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
        
}


           



window.addEventListener('load', init );


window.setInterval(function(){
    
    var messages = $("#messages");    
        
             
    if (recording){
        var dweetWriteUrl = "https://dweet.io/dweet/for/" + dweetNamespace + "?volume=" + avgMagnitude;
        
        
        var date = new Date().toISOString().replace("T", " ").substring(0, 19);
        var message = $('<div>')
                        .text(date + ":  Pubblicato volume su dweet: ");
        var writeLink = $('<a>')
                        .text(dweetWriteUrl)
                        .attr('href', dweetWriteUrl)
                        .attr('target', '_blank');
                        
        message.append(writeLink);
        messages.append(message);
        
        messages.animate({
            scrollTop: $("#messages").scrollHeight
        });
        
        console.log("Pubblicato: ", dweetWriteUrl );               
        console.log("Per leggere da dweet:       ", dweetReadUrl(dweetNamespace));
        
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (xhttp.readyState == 4 && xhttp.status == 200) {
                console.log("Richiesta andata a buon fine");
            }
            
            if (xhttp.readyState == 4 && xhttp.status !== 200) {
                console.error("La richiesta non ha funzionato!");
            } 
        };
        xhttp.open("GET", dweetWriteUrl, true);
        xhttp.send();   
       
  } 
    
}, 3000);


