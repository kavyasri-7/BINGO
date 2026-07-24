package com.housie.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long ticketId;

    @Column(nullable = false)
    private String roomCode;

    @Column(nullable = false)
    private String userUid;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String ticketNumbersJson; // 3x9 JSON matrix array
}
