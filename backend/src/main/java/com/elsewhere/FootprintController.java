package com.elsewhere;

import java.util.List;
import com.elsewhere.FootprintService.Legacy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/footprints")
public class FootprintController {
    private final AuthService auth;
    private final FootprintService footprints;

    public FootprintController(AuthService auth, FootprintService footprints) {
        this.auth = auth;
        this.footprints = footprints;
    }

    public record ImportRequest(@NotNull @Size(max = 200) List<@NotNull @Valid Legacy> records) {}

    @GetMapping
    public List<FootprintService.Photo> list(@CookieValue(name = AuthController.COOKIE, required = false) String token) {
        return footprints.list(auth.requireUser(token).id());
    }

    @PostMapping
    public ResponseEntity<FootprintService.Photo> create(@CookieValue(name = AuthController.COOKIE, required = false) String token,
                                                         @Valid @RequestBody FootprintService.Draft draft) {
        return ResponseEntity.status(201).body(footprints.create(auth.requireUser(token).id(), draft));
    }

    @GetMapping("/{id}")
    public FootprintService.Photo get(@CookieValue(name = AuthController.COOKIE, required = false) String token,
                                      @PathVariable String id) {
        return footprints.get(auth.requireUser(token).id(), id);
    }

    @PutMapping("/{id}")
    public FootprintService.Photo update(@CookieValue(name = AuthController.COOKIE, required = false) String token,
                                         @PathVariable String id, @Valid @RequestBody FootprintService.Draft draft) {
        return footprints.update(auth.requireUser(token).id(), id, draft);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CookieValue(name = AuthController.COOKIE, required = false) String token, @PathVariable String id) {
        footprints.delete(auth.requireUser(token).id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    public List<FootprintService.Photo> importLegacy(@CookieValue(name = AuthController.COOKIE, required = false) String token,
                                                     @Valid @RequestBody ImportRequest request) {
        return footprints.importLegacy(auth.requireUser(token).id(), request.records());
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@CookieValue(name = AuthController.COOKIE, required = false) String token, @PathVariable String id) {
        var photo = footprints.photo(auth.requireUser(token).id(), id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff").contentType(MediaType.parseMediaType(photo.type())).body(photo.data());
    }
}
