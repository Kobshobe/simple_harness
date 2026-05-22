import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export async function executeBash({ command, cwd }) {
    console.log(`[bash] ${command}`);
    try {
        const { stdout, stderr } = await execAsync(command, { 
            cwd: cwd || process.cwd(),
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer to handle large outputs
        });
        
        return {
            success: true,
            command: command,
            stdout: stdout,
            stderr: stderr,
            exitCode: 0
        };
    } catch (error) {
        return {
            success: false,
            command: command,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exitCode: error.code || 1
        };
    }
}
