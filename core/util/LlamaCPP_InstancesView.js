import LogMaster from "../LogMaster.js";
import ColorText from '../useful/ColorText.js'

function LlamaCPP_InstancesView(onExitCallback) {
    let intervalId;
    let isExiting = false;

    // Handle Ctrl+C
    const exitHandler = () => {
        if (isExiting) return;
        
        isExiting = true;
        console.log('\nStopping monitoring...');
        
        // Clear the interval
        if (intervalId) {
            clearInterval(intervalId);
        }
        
        // Execute the callback if provided
        if (onExitCallback && typeof onExitCallback === 'function') {
            onExitCallback();
        }
        
        // Don't exit the process, just stop the interval
        console.log('Monitoring stopped. Press any key to continue...');
    };

    // Set up signal handlers
    process.on('SIGINT', exitHandler);

    // Start the monitoring loop
    intervalId = setInterval(() => {
        console.clear();
        let result = LogMaster.getLogs({type: 'LlamaCPP Instances', limit: 1, reverse: true}).at(0);
        
        if (result && result.EventContent) {
            result.EventContent.forEach((e, i) => {
                if (!e.ServerOn) {
                    console.log(ColorText.red(`- SLOT ${i+1} - \nPort : ${e.ServerPort}\nModel : ${e.ModelPath}\nIdleTime : ${Date.now()-e.LastAction}`));
                } else {
                    if (e.InUse) {
                        console.log(ColorText.brightYellow(`- SLOT ${i+1} - \nPort : ${e.ServerPort}\nModel : ${e.ModelPath}\nIdleTime : ${Date.now()-e.LastAction}`));
                    } else {
                        console.log(ColorText.green(`- SLOT ${i+1} - \nPort : ${e.ServerPort}\nModel : ${e.ModelPath}\nIdleTime : ${Date.now()-e.LastAction}`));
                    }
                }
                console.log('');
            });
        }
    }, 100);

    console.log('Monitoring started. Press Ctrl+C to stop.');
    
    // Return a function to manually stop monitoring
    return () => {
        exitHandler();
        process.removeListener('SIGINT', exitHandler);
    };
}


export default LlamaCPP_InstancesView