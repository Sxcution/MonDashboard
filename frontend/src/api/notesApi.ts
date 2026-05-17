// Notes API facade. Endpoint values come from the existing Jinja data attributes.
(function () {
    function fromConfig(config: NotesApiConfig) {
        const http = window.MonHttp;
        return {
            getNotes() {
                return http.request<NotesNote[]>(config.getNotesUrl);
            },
            addNote(payload: Partial<NotesNote>) {
                return http.postJson<NotesNote>(config.addNoteUrl, payload);
            },
            updateNote(noteId: NoteId, payload: Partial<NotesNote>) {
                return http.postJson<NotesNote>(`${config.updateNoteBase}${noteId}`, payload);
            },
            deleteNote(noteId: NoteId, method: "POST" | "DELETE" = "POST") {
                return http.request(`${config.deleteNoteBase}${noteId}`, { method });
            },
            toggleMark(noteId: NoteId) {
                return http.request(`${config.toggleMarkBase}${noteId}`, { method: "POST" });
            }
        };
    }

    window.NotesApiFactory = { fromConfig };
})();
