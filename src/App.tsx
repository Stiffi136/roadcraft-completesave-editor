import { useState } from 'react';
import { decodeFile, encodeFile, type DecodedFileType } from './processFile';
import { JsonEditor } from 'json-edit-react';
import { Button } from './components/ui/button';

function App() {

    const [decodedFile, setDecodedFile] = useState<DecodedFileType>();

    const [fileContent, setFileContent] = useState<unknown>();

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const file: File = event.target.files[0];
        const data = await decodeFile(file);
        setDecodedFile(data);
        let textDecoder = new TextDecoder();
        let jsonString = textDecoder.decode(data.decompressedData);
        setFileContent(JSON.parse(jsonString));
    }

    const handleDownload = () => {
        if (!decodedFile) return;
        const jsonString = JSON.stringify(fileContent, null, 3);
        const decompressedData = new TextEncoder().encode(jsonString);
        const result = encodeFile(decodedFile?.fileContent, decompressedData)

        if (!result) return;

        // File content and filename
        const fileName = "OutputSave";

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = URL.createObjectURL(result);
        link.download = fileName;

        // Programmatically click the link to trigger the download
        link.click();

        // Clean up the URL object
        URL.revokeObjectURL(link.href);
    }


    return (
        <div className='space-x-2 space-y-4 container mx-auto'>
            <h1 className='text-4xl'>Roadcraft CompleteSave Editor</h1>
            <p>No warranty. Please keep backups of your save when using this tool!</p>
            <p>Save Game Location:</p>
            <p>Windows <code className='text-pink-700 bg-slate-300 p-2 rounded'>%LOCALAPPDATA%\RoadCraft\</code></p>
            <p>Steam <code className='text-pink-700 bg-slate-300 p-2 rounded'>%LOCALAPPDATA%\Saber\RoadCraftGame\storage\steam\user\<b>STEAMUSER-ID</b>\Main\save\</code></p>
            <p>Linux <code className='text-pink-700 bg-slate-300 p-2 rounded'><b>STEAMLIBRARY-FOLDER</b>/steamapps/compatdata/2104890/pfx/</code></p>
            <Button>
                <input type='file' id='file-input' onChange={handleFileSelect}></input>
            </Button>
            <Button disabled={!decodedFile} onClick={handleDownload}>Download</Button>
            <JsonEditor data={fileContent} setData={setFileContent} collapse collapseAnimationTime={0} maxWidth="100%" />
        </div>
    )
}

export default App
