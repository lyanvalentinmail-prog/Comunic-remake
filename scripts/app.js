// --- APLICAR AJUSTE DE GRILLA GUARDADO ---
const tamanoGuardado = localStorage.getItem('comunicador_tamano_grilla') || 'mediano';
const diccionarioTamanos = { 'pequeno': '80px', 'mediano': '110px', 'grande': '160px' };
document.documentElement.style.setProperty('--tamano-grilla', diccionarioTamanos[tamanoGuardado]);
// -----------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    let db;
    let fraseActual = [];
    let sortableInstance = null;
    let isPlayingSequence = false;
    let datosGlobales = null;

    // Vocabulario núcleo original
    const vocabularioNucleo = [
        { texto: "Yo", tipo: "pronombre", hablar: "Yo" },
        { texto: "Quiero", tipo: "verbo", hablar: "Quiero" },
        { texto: "Ayuda", tipo: "sustantivo", hablar: "Ayuda" },
        { texto: "Más", tipo: "adverbio", hablar: "Más" },
        { texto: "Sí", tipo: "adverbio", hablar: "Sí" }, // Mejor con tilde para ARASAAC
        { texto: "No", tipo: "adverbio", hablar: "No" },
        { texto: "Hola", tipo: "interjeccion", hablar: "Hola" },
        { texto: "Terminar", tipo: "verbo", hablar: "Terminar" },
        { texto: "Jugar", tipo: "verbo", hablar: "Jugar" },
        { texto: "Gusta", tipo: "verbo", hablar: "Me gusta" }
    ];

    async function initDB() {
        return new Promise((resolve, reject) => {
            // Cambiamos a v6 para limpiar la caché de placeholders rotos del intento anterior
            const request = window.indexedDB.open('comunicador-db-v6', 1);
            request.onerror = e => reject(e.target.error);
            request.onsuccess = e => resolve(e.target.result);
            request.onupgradeneeded = e => {
                const dbInstance = e.target.result;
                if (!dbInstance.objectStoreNames.contains('pictogramas')) {
                    dbInstance.createObjectStore('pictogramas');
                }
            };
        });
    }

    function promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    try {
        db = await initDB();
    } catch (error) {
        console.warn("IndexedDB no disponible", error);
        db = null;
    }

    async function cargarDatosGlobales() {
        if (!datosGlobales) {
            try {
                const response = await fetch('data/datos.json');
                datosGlobales = await response.json();
            } catch (error) {
                console.error("Error al cargar datos.json:", error);
            }
        }
        return datosGlobales;
    }

    async function obtenerYCachearPictograma(item) {
        let textoBusqueda = item.texto || item.nombre;
        if (!textoBusqueda || textoBusqueda.trim() === '') return 'assets/images/placeholder.png';
        if (!db) return 'assets/images/placeholder.png';

        // Limpiamos signos de interrogación para mejorar la búsqueda en ARASAAC
        textoBusqueda = textoBusqueda.replace(/[¿?]/g, '');

        try {
            const transaccionLectura = db.transaction('pictogramas', 'readonly');
            const pictogramaGuardado = await promisifyRequest(transaccionLectura.objectStore('pictogramas').get(textoBusqueda));
            if (pictogramaGuardado) return URL.createObjectURL(pictogramaGuardado);

            // Búsqueda dinámica 
            const textoCodificado = encodeURIComponent(textoBusqueda);
            const urlBusqueda = `https://api.arasaac.org/api/pictograms/es/search/${textoCodificado}`;
            const responseBusqueda = await fetch(urlBusqueda);
            
            if (!responseBusqueda.ok) throw new Error('Error en búsqueda ARASAAC');
            
            const resultados = await responseBusqueda.json();
            if (resultados.length === 0) return 'assets/images/placeholder.png';
            
            const urlImagen = `https://api.arasaac.org/api/pictograms/${resultados[0]._id}?download=false`;
            const response = await fetch(urlImagen); 
            
            if (!response.ok) throw new Error('Error al descargar imagen');

            const imagenBlob = await response.blob();
            const transaccionEscritura = db.transaction('pictogramas', 'readwrite');
            await promisifyRequest(transaccionEscritura.objectStore('pictogramas').put(imagenBlob, textoBusqueda));

            return URL.createObjectURL(imagenBlob);
        } catch (error) {
            console.warn(`No se encontró imagen para: ${textoBusqueda}`);
            return 'assets/images/placeholder.png';
        }
    }

    // Motor nativo de Voz
    function hablarTextoIndividual(texto) {
        if (isPlayingSequence || !texto || texto.trim() === '') return;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); 
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // Leer frase con resaltado visual
    function hablarFraseSecuencial() {
        if (isPlayingSequence || fraseActual.length === 0) return;
        if (!('speechSynthesis' in window)) return;

        isPlayingSequence = true;
        const btnHablar = document.getElementById('hablar-frase-btn');
        if (btnHablar) btnHablar.classList.add('pulsing');

        window.speechSynthesis.cancel();

        let index = 0;
        const pictogramaDivs = document.querySelectorAll('#tira-frase .pictograma-frase-contenido');

        function leerSiguiente() {
            if (index >= fraseActual.length) {
                isPlayingSequence = false;
                if (btnHablar) btnHablar.classList.remove('pulsing');
                pictogramaDivs.forEach(div => div.classList.remove('leyendo-activo'));
                return;
            }

            const picto = fraseActual[index];
            const textoParaHablar = picto.hablar || picto.texto;
            const utterance = new SpeechSynthesisUtterance(textoParaHablar);
            utterance.lang = 'es-ES';
            utterance.rate = 0.85;

            pictogramaDivs.forEach(div => div.classList.remove('leyendo-activo'));
            if (pictogramaDivs[index]) {
                pictogramaDivs[index].classList.add('leyendo-activo');
            }

            utterance.onend = () => { index++; leerSiguiente(); };
            utterance.onerror = () => { index++; leerSiguiente(); };

            window.speechSynthesis.speak(utterance);
        }

        leerSiguiente();
    }

    function actualizarSugerenciasPredictivas() {
        const categoriasGrid = document.getElementById('categorias-grid');
        if (!categoriasGrid) return;

        if (fraseActual.length === 0) {
            Array.from(categoriasGrid.children).forEach(btn => btn.classList.remove('highlight-sugerencia'));
            return;
        }

        const ultimoPicto = fraseActual[fraseActual.length - 1];
        let categoriasSugeridas = [];

        if (ultimoPicto.tipo === 'pronombre') {
            categoriasSugeridas = ['Acciones', 'Quiero', 'Me siento', 'Preguntas'];
        } else if (['Quiero', 'Comer', 'Beber'].includes(ultimoPicto.texto) || ultimoPicto.tipo === 'verbo') {
            categoriasSugeridas = ['Comida', 'Bebidas', 'Juguetes y Pasatiempos', 'Lugares', 'Acciones'];
        } else if (ultimoPicto.texto?.toLowerCase() === 'me siento' || ultimoPicto.nombre === 'Me siento' || ultimoPicto.tipo === 'adjetivo') {
            categoriasSugeridas = ['Me siento', 'Cuerpo', 'Me duele'];
        } else if (ultimoPicto.tipo === 'interjeccion' || ultimoPicto.tipo === 'frase') {
            categoriasSugeridas = ['Social', 'Personas'];
        } else if (ultimoPicto.texto === 'Ayuda') {
            categoriasSugeridas = ['Acciones', 'Me duele', 'Cuerpo', 'Personas'];
        }

        Array.from(categoriasGrid.children).forEach(btn => {
            const spanText = btn.querySelector('span')?.textContent;
            if (spanText && categoriasSugeridas.includes(spanText)) {
                btn.classList.add('highlight-sugerencia');
            } else {
                btn.classList.remove('highlight-sugerencia');
            }
        });
    }

    function agregarAPipa(pictograma) {
        fraseActual.push(pictograma);
        renderizarTiraFrase();
        hablarTextoIndividual(pictograma.hablar || pictograma.texto || pictograma.nombre);
        actualizarSugerenciasPredictivas(); 
    }

    function obtenerClaseFitzgerald(tipo) {
        if (!tipo) return 'fitz-default';
        const t = tipo.toLowerCase();
        if (t === 'pronombre' || t === 'persona') return 'fitz-pronombre';
        if (t === 'verbo' || t === 'accion') return 'fitz-verbo';
        if (t === 'sustantivo' || t === 'letra') return 'fitz-sustantivo';
        if (t === 'adjetivo') return 'fitz-adjetivo';
        if (t === 'adverbio') return 'fitz-adverbio';
        if (t === 'interjeccion' || t === 'frase' || t === 'social' || t === 'conjuncion' || t === 'preposicion') return 'fitz-social';
        return 'fitz-default';
    }

    async function renderizarTiraFrase() {
        const tiraFraseContainer = document.getElementById('tira-frase-container');
        const tiraFraseContainerText = document.getElementById('tira-frase-container-text');
        const tiraFraseControles = document.getElementById('tira-frase-controles');
        const tiraFraseDiv = document.getElementById('tira-frase');
        const tiraFraseTexto = document.getElementById('tira-frase-texto');

        if (!tiraFraseDiv || !tiraFraseTexto || !tiraFraseContainer) return;

        tiraFraseDiv.innerHTML = '';

        fraseActual.forEach((pictograma, index) => {
            const pictogramaContenedor = document.createElement('div');
            pictogramaContenedor.className = 'pictograma-frase';

            const pictogramaContenido = document.createElement('div');
            pictogramaContenido.className = `pictograma-frase-contenido ${obtenerClaseFitzgerald(pictograma.tipo)}`;

            const img = document.createElement('img');
            obtenerYCachearPictograma(pictograma).then(src => img.src = src);

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn-borrar-pictograma';
            btnBorrar.innerHTML = '&times;';
            btnBorrar.onclick = (e) => {
                e.stopPropagation();
                fraseActual.splice(index, 1);
                renderizarTiraFrase();
                actualizarSugerenciasPredictivas();
            };

            pictogramaContenido.appendChild(img);
            pictogramaContenedor.appendChild(pictogramaContenido);
            pictogramaContenedor.appendChild(btnBorrar);
            tiraFraseDiv.appendChild(pictogramaContenedor);
        });

        const fraseComoTexto = fraseActual.map(p => p.hablar || p.texto || p.nombre).join(' ');
        tiraFraseTexto.textContent = fraseComoTexto;
        tiraFraseDiv.scrollLeft = tiraFraseDiv.scrollWidth;

        if (fraseActual.length === 0) {
            tiraFraseContainer.classList.add('hidden');
            tiraFraseContainerText.classList.add('hidden');
        } else {
            tiraFraseContainer.classList.remove('hidden');
            tiraFraseContainerText.classList.remove('hidden');
        }

        // Mantiene el botón de audio visible, pero evita compartir una frase vacía.
        tiraFraseControles?.classList.remove('hidden');
        tiraFraseControles?.querySelectorAll('button').forEach(button => {
            button.disabled = fraseActual.length === 0;
        });
        document.getElementById('frase-actions-hint')?.classList.toggle('hidden', fraseActual.length > 0);
    }

    function inicializarDragAndDrop() {
        const tiraFraseDiv = document.getElementById('tira-frase');
        if (!tiraFraseDiv) return;
        if (sortableInstance) sortableInstance.destroy();
        
        sortableInstance = new Sortable(tiraFraseDiv, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: function (evt) {
                const [movedItem] = fraseActual.splice(evt.oldIndex, 1);
                fraseActual.splice(evt.newIndex, 0, movedItem);
                renderizarTiraFrase(); 
            },
        });
    }

    async function crearBotonPictograma(item) {
        const pictoButton = document.createElement('button');
        const claseFitzgerald = obtenerClaseFitzgerald(item.tipo || item.categoria_tipo);
        pictoButton.className = `pictograma-button ${claseFitzgerald}`;

        const img = document.createElement('img');
        img.src = 'assets/images/placeholder.png'; // Cargamos placeholder inicial
        
        // Empezamos a buscar la imagen real
        obtenerYCachearPictograma(item).then(src => {
            img.src = src;
        });
        
        const span = document.createElement('span');
        span.textContent = item.texto || item.nombre;
        
        pictoButton.appendChild(img);
        pictoButton.appendChild(span);
        return pictoButton;
    }

    // CARGA SECUENCIAL PARA NO SATURAR ARASAAC
    async function cargarNucleo() {
        const nucleoGrid = document.getElementById('nucleo-grid');
        if (!nucleoGrid) return;
        nucleoGrid.innerHTML = '';
        
        // En lugar de disparar todos a la vez, los procesamos uno por uno en fila
        for (const palabra of vocabularioNucleo) {
            const btn = await crearBotonPictograma(palabra);
            btn.addEventListener('click', () => agregarAPipa(palabra));
            nucleoGrid.appendChild(btn);
        }
    }

    // CARGA SECUENCIAL PARA LAS CATEGORÍAS
    async function cargarCategoriasPerifericas() {
        const data = await cargarDatosGlobales();
        const categoriasGrid = document.getElementById('categorias-grid');
        if (!categoriasGrid || !data) return;
        categoriasGrid.innerHTML = '';
        
        for (const categoria of data.categorias) {
            categoria.categoria_tipo = 'sustantivo'; 
            const btn = await crearBotonPictograma(categoria);
            btn.addEventListener('click', () => mostrarImagenes(categoria));
            categoriasGrid.appendChild(btn);
        }
    }

    async function mostrarImagenes(categoria) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const imagenesGrid = document.getElementById('imagenes-grid');
        const categoriasGrid = document.getElementById('categorias-grid');
        const seccionNucleo = document.getElementById('seccion-nucleo');
        const tituloCategoria = document.getElementById('titulo-categoria');
        const backButton = document.getElementById('back-button');

        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        await new Promise(resolve => setTimeout(resolve, 30));

        imagenesGrid.innerHTML = '';

        // CARGA SECUENCIAL PARA LAS IMÁGENES INTERNAS
        for (const imagen of categoria.imagenes) {
            if (imagen.separador) {
                const separador = document.createElement('hr');
                separador.className = 'separador';
                imagenesGrid.appendChild(separador);
            } else {
                const imgButton = await crearBotonPictograma(imagen);
                imgButton.addEventListener('click', () => agregarAPipa(imagen));
                imagenesGrid.appendChild(imgButton);
            }
        }

        categoriasGrid.classList.add('hidden');
        seccionNucleo.classList.add('hidden');
        imagenesGrid.classList.remove('hidden');
        tituloCategoria.textContent = categoria.nombre;
        backButton.classList.remove('hidden');

        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    if (document.getElementById('nucleo-grid')) {
        await cargarDatosGlobales(); 
        await cargarNucleo();
        await cargarCategoriasPerifericas();
        
        inicializarDragAndDrop();
        renderizarTiraFrase();
        
        document.getElementById('hablar-frase-btn')?.addEventListener('click', hablarFraseSecuencial);
        
        document.getElementById('borrar-frase-btn')?.addEventListener('click', () => {
            fraseActual = [];
            renderizarTiraFrase();
            actualizarSugerenciasPredictivas();
        });

        const btnBorrarUltimo = document.getElementById('borrar-ultimo-btn');
        if (btnBorrarUltimo) {
            btnBorrarUltimo.addEventListener('click', (e) => {
                e.preventDefault();
                if (fraseActual.length > 0) {
                    fraseActual.pop();
                    renderizarTiraFrase();
                    actualizarSugerenciasPredictivas();
                }
            });
        }

        document.getElementById('back-button')?.addEventListener('click', () => {
            document.getElementById('seccion-nucleo').classList.remove('hidden');
            document.getElementById('categorias-grid').classList.remove('hidden');
            document.getElementById('imagenes-grid').classList.add('hidden');
            document.getElementById('back-button').classList.add('hidden');
            document.getElementById('titulo-categoria').textContent = 'Categorías';
            actualizarSugerenciasPredictivas(); 
        });

        function obtenerTextoDeFrase() {
            const texto = fraseActual
                .map(pictograma => pictograma.hablar || pictograma.texto || pictograma.nombre || '')
                .filter(Boolean)
                .join(' ')
                .trim();
            return texto ? texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1) : '';
        }

        const shareFraseBtn = document.getElementById('share-frase-btn');
        if (navigator.share && shareFraseBtn) {
            shareFraseBtn.addEventListener('click', async () => {
                const textoFinal = obtenerTextoDeFrase();
                if (!textoFinal) return;
                try {
                    await navigator.share({ title: 'Frase desde Mi Comunicador', text: textoFinal });
                } catch (error) {
                    if (error.name !== 'AbortError') console.error('No se pudo compartir la frase:', error);
                }
            });
        } else if (shareFraseBtn) {
            shareFraseBtn.style.display = 'none';
        }

        const shareAudioBtn = document.getElementById('share-audio-btn');
        const audioDialog = document.getElementById('audio-share-dialog');
        const audioPhrase = document.getElementById('audio-share-phrase');
        const generateAudioBtn = document.getElementById('generate-audio-btn');
        const audioPreview = document.getElementById('audio-preview');
        const audioStatus = document.getElementById('audio-share-status');
        const shareAudioFileBtn = document.getElementById('share-audio-file-btn');
        const downloadAudioBtn = document.getElementById('download-audio-btn');
        const closeAudioBtn = document.getElementById('close-audio-share');

        let speechEnginePromise = null;
        let generatedAudioBlob = null;
        let generatedAudioUrl = null;
        let audioPhraseToShare = '';

        function revokeGeneratedAudio() {
            if (generatedAudioUrl) {
                URL.revokeObjectURL(generatedAudioUrl);
                generatedAudioUrl = null;
            }
            generatedAudioBlob = null;
            if (audioPreview) {
                audioPreview.pause();
                audioPreview.removeAttribute('src');
                audioPreview.hidden = true;
                audioPreview.load();
            }
            if (shareAudioFileBtn) shareAudioFileBtn.hidden = true;
            if (downloadAudioBtn) downloadAudioBtn.hidden = true;
        }

        async function cargarMotorDeVoz() {
            if (!window.meSpeak) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'scripts/vendor/mespeak.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('No se pudo cargar el sintetizador de voz.'));
                    document.head.appendChild(script);
                });
            }

            if (!window.meSpeak.isConfigLoaded()) {
                const response = await fetch('scripts/vendor/mespeak/mespeak_config.json');
                if (!response.ok) throw new Error('No se pudo cargar la configuración de voz.');
                window.meSpeak.loadConfig(await response.json());
            }

            if (!window.meSpeak.isVoiceLoaded('es-la')) {
                const response = await fetch('scripts/vendor/mespeak/voices/es-la.json');
                if (!response.ok) throw new Error('No se pudo cargar la voz en español.');
                window.meSpeak.loadVoice(await response.json());
            }

            return window.meSpeak;
        }

        function obtenerMotorDeVoz() {
            if (!speechEnginePromise) {
                speechEnginePromise = cargarMotorDeVoz();
                speechEnginePromise.catch(() => { speechEnginePromise = null; });
            }
            return speechEnginePromise;
        }

        function abrirDialogoDeAudio() {
            const texto = obtenerTextoDeFrase();
            if (!texto || !audioDialog || !audioPhrase) return;

            revokeGeneratedAudio();
            audioPhraseToShare = texto;
            audioPhrase.textContent = texto;
            if (generateAudioBtn) generateAudioBtn.disabled = false;
            if (audioStatus) audioStatus.textContent = 'Se creará un WAV con voz sintética en español.';

            if (typeof audioDialog.showModal === 'function') {
                audioDialog.showModal();
            } else {
                audioDialog.setAttribute('open', '');
            }
            generateAudioBtn?.focus();
        }

        shareAudioBtn?.addEventListener('click', abrirDialogoDeAudio);

        function cerrarDialogoDeAudio() {
            if (audioDialog?.open && typeof audioDialog.close === 'function') {
                audioDialog.close();
            } else if (audioDialog) {
                audioDialog.removeAttribute('open');
                revokeGeneratedAudio();
            }
        }

        closeAudioBtn?.addEventListener('click', cerrarDialogoDeAudio);
        audioDialog?.addEventListener('click', event => {
            if (event.target === audioDialog) cerrarDialogoDeAudio();
        });
        audioDialog?.addEventListener('close', revokeGeneratedAudio);

        generateAudioBtn?.addEventListener('click', async () => {
            if (!audioPhraseToShare) return;
            generateAudioBtn.disabled = true;
            if (audioStatus) audioStatus.textContent = 'Cargando la voz y generando el audio…';

            try {
                const engine = await obtenerMotorDeVoz();
                const samples = engine.speak(audioPhraseToShare, {
                    rawdata: 'array',
                    voice: 'es-la',
                    speed: 155,
                    pitch: 50,
                    amplitude: 100
                });

                if (!samples || samples.length < 44) {
                    throw new Error('El sintetizador no produjo un archivo de audio.');
                }

                const wavBytes = samples instanceof Uint8Array ? samples : Uint8Array.from(samples);
                generatedAudioBlob = new Blob([wavBytes], { type: 'audio/wav' });
                generatedAudioUrl = URL.createObjectURL(generatedAudioBlob);
                audioPreview.src = generatedAudioUrl;
                audioPreview.hidden = false;
                shareAudioFileBtn.hidden = false;
                downloadAudioBtn.hidden = false;
                if (audioStatus) audioStatus.textContent = 'Audio listo. Puedes escucharlo, compartirlo o descargarlo.';
            } catch (error) {
                console.error('No se pudo generar el audio:', error);
                if (audioStatus) audioStatus.textContent = 'No se pudo generar el audio. Comprueba los archivos de la app e inténtalo otra vez.';
            } finally {
                generateAudioBtn.disabled = false;
            }
        });

        function descargarAudioGenerado() {
            if (!generatedAudioBlob || !generatedAudioUrl) return;
            const link = document.createElement('a');
            link.href = generatedAudioUrl;
            link.download = 'mensaje-comunicador.wav';
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        downloadAudioBtn?.addEventListener('click', () => {
            descargarAudioGenerado();
            if (audioStatus) audioStatus.textContent = 'WAV descargado. Ya puedes adjuntarlo en WhatsApp u otra aplicación.';
        });

        shareAudioFileBtn?.addEventListener('click', async () => {
            if (!generatedAudioBlob) return;

            if (typeof File === 'undefined' || !navigator.share || !navigator.canShare) {
                descargarAudioGenerado();
                if (audioStatus) audioStatus.textContent = 'Este navegador no comparte archivos directamente. Descargué el WAV para que puedas adjuntarlo en el chat.';
                return;
            }

            const audioFile = new File([generatedAudioBlob], 'mensaje-comunicador.wav', {
                type: 'audio/wav',
                lastModified: Date.now()
            });

            try {
                if (!navigator.canShare({ files: [audioFile] })) {
                    descargarAudioGenerado();
                    if (audioStatus) audioStatus.textContent = 'Este navegador no comparte archivos directamente. Descargué el WAV para que puedas adjuntarlo en el chat.';
                    return;
                }

                await navigator.share({
                    title: 'Mensaje de voz desde ComuniC',
                    text: audioPhraseToShare,
                    files: [audioFile]
                });
                if (audioStatus) audioStatus.textContent = 'Audio compartido.';
            } catch (error) {
                if (error.name === 'AbortError') {
                    if (audioStatus) audioStatus.textContent = 'Compartir cancelado. El audio sigue listo.';
                } else {
                    console.error('No se pudo compartir el archivo de audio:', error);
                    descargarAudioGenerado();
                    if (audioStatus) audioStatus.textContent = 'No se pudo abrir el menú para compartir. Descargué el WAV para que puedas adjuntarlo.';
                }
            }
        });
    }
});
