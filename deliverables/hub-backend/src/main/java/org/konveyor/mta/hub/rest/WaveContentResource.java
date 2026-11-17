package org.konveyor.mta.hub.rest;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Wave;
import org.konveyor.mta.hub.model.WaveDependency;
import org.konveyor.mta.hub.model.WaveEvidence;
import org.konveyor.mta.hub.model.WaveTicket;
import org.konveyor.mta.hub.security.Scopes;

import java.util.List;
import java.util.UUID;

/**
 * Wave content (#46 item 1: membership is the unit of planning) — the
 * dependencies (#23), verification evidence, and tracker tickets that
 * aggregate over a wave's member set. Tickets follow the application, so
 * they are keyed by app and wave-filtered through membership.
 */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class WaveContentResource {

    public record DepView(UUID id, String from, String to, String verb) {
        public static DepView of(WaveDependency d) {
            return new DepView(d.id, d.fromApp.name, d.toApp.name, d.verb);
        }
    }

    public record EvidenceView(UUID id, String application, String coverage, int total, int run, int red) {
        public static EvidenceView of(WaveEvidence e) {
            return new EvidenceView(e.id, e.application.name, e.coverage, e.total, e.run, e.red);
        }
    }

    public record TicketView(UUID id, String application, String title, String key,
                             String outcome, String detail, String whenText) {
        public static TicketView of(WaveTicket t) {
            return new TicketView(t.id, t.application.name, t.title, t.key,
                    t.outcome.name(), t.detail, t.whenText);
        }
    }

    @GET
    @Path("/wave-dependencies")
    @Scopes("waves:read")
    public Response dependencies() {
        List<DepView> items = WaveDependency.<WaveDependency>findAll().list().stream().map(DepView::of).toList();
        return Responses.pagedResponse(items, items.size(), 1, items.size());
    }

    @GET
    @Path("/wave-evidence")
    @Scopes("waves:read")
    public Response evidence(@QueryParam("wave") UUID waveId) {
        List<WaveEvidence> rows = WaveEvidence.<WaveEvidence>findAll().list();
        if (waveId != null) {
            Wave wave = Wave.findById(waveId);
            if (wave != null) {
                rows = rows.stream().filter(e -> wave.members.contains(e.application)).toList();
            }
        }
        List<EvidenceView> items = rows.stream().map(EvidenceView::of).toList();
        return Responses.pagedResponse(items, items.size(), 1, items.size());
    }

    @GET
    @Path("/wave-tickets")
    @Scopes("waves:read")
    public Response tickets(@QueryParam("wave") UUID waveId) {
        List<WaveTicket> rows = WaveTicket.<WaveTicket>findAll().list();
        if (waveId != null) {
            Wave wave = Wave.findById(waveId);
            if (wave != null) {
                rows = rows.stream().filter(t -> wave.members.contains(t.application)).toList();
            }
        }
        List<TicketView> items = rows.stream().map(TicketView::of).toList();
        return Responses.pagedResponse(items, items.size(), 1, items.size());
    }
}
